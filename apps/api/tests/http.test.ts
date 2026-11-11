import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { fixture, fact } from './fixture.ts';

test('未登录、错密码和未知路由使用统一错误信封', async () => {
  const { api, dispose } = await fixture();
  try {
    const unauthorized = await api.get('/api/v1/outbound').expect(401);
    assert.equal(unauthorized.body.code, 'UNAUTHORIZED');
    assert.ok(unauthorized.body.traceId);
    await api.post('/api/v1/auth/login').send({ username: 'owner', password: 'wrong', channel: 'pda' }).expect(401);
    await api.get('/unknown').expect(404);
  } finally {
    await dispose();
  }
});
test('PDA/小程序凭据禁止确认，Web 凭据禁止扫码写入', async () => {
  const { api, app, dispose } = await fixture();
  try {
    for (const channel of ['pda', 'miniapp']) {
      const login = await api
        .post('/api/v1/auth/login')
        .send({ username: 'owner', password: 'test-only-password', channel })
        .expect(200);
      await api
        .post('/api/v1/outbound/DEMO-001/confirm')
        .auth(login.body.data.token, { type: 'bearer' })
        .send({})
        .expect(403);
      if (channel === 'miniapp')
        await api
          .post('/api/v1/scan/plans/DEMO-001/facts')
          .auth(login.body.data.token, { type: 'bearer' })
          .send(fact())
          .expect(403);
    }
    const web = request.agent(app);
    await web
      .post('/api/v1/auth/login')
      .send({ username: 'owner', password: 'test-only-password', channel: 'web' })
      .expect(200);
    await web.post('/api/v1/scan/plans/DEMO-001/facts').send(fact()).expect(403);
    await web.post('/api/v1/outbound/DEMO-001/confirm').send({}).expect(403);
  } finally {
    await dispose();
  }
});
test('HTTP 完整闭环：登录、扫码、冻结、Web 确认、只读查询', async () => {
  const { api, app, dispose } = await fixture();
  try {
    const pda = await api
      .post('/api/v1/auth/login')
      .send({ username: 'owner', password: 'test-only-password', channel: 'pda' });
    const token = pda.body.data.token;
    for (const input of [fact(), fact({ barcode: 'DEMO-032-12', weightGrams: 297500 })])
      await api.post('/api/v1/scan/plans/DEMO-001/facts').auth(token, { type: 'bearer' }).send(input).expect(200);
    const detail = (await api.get('/api/v1/scan/plans/DEMO-001').auth(token, { type: 'bearer' })).body.data;
    const frozen = (
      await api
        .post('/api/v1/scan/plans/DEMO-001/submit')
        .auth(token, { type: 'bearer' })
        .set('Idempotency-Key', randomUUID())
        .send({ revision: detail.revision, digest: detail.digest })
        .expect(200)
    ).body.data;
    const web = request.agent(app);
    await web.post('/api/v1/auth/login').send({ username: 'owner', password: 'test-only-password', channel: 'web' });
    await web
      .post('/api/v1/outbound/DEMO-001/confirm')
      .set('Origin', 'http://127.0.0.1:5173')
      .set('Idempotency-Key', randomUUID())
      .send({
        revision: frozen.revision,
        digest: frozen.digest,
        lines: frozen.lines.map((line: { id: string; actualPackages: number; actualWeightGrams: number }) => ({
          lineId: line.id,
          actualPackages: line.actualPackages,
          actualWeightGrams: line.actualWeightGrams,
        })),
      })
      .expect(200);
    const final = (await api.get('/api/v1/outbound/DEMO-001').auth(token, { type: 'bearer' }).expect(200)).body.data;
    assert.equal(final.status, 'confirmed');
    assert.equal(final.actualWeightGrams, 600000);
    const page = (await web.get('/api/v1/outbound?pageSize=1&status=confirmed').expect(200)).body.data;
    assert.equal(page.items.length, 1);
    assert.equal(page.total, 1);
    await web.get('/api/v1/outbound?pageSize=999').expect(422);
  } finally {
    await dispose();
  }
});
