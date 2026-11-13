import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { catalogFixture, upload } from './catalog-fixture.ts';
import { createApp } from '../src/app.ts';
import { catalogVersionSchema } from '@wms/contracts';

const origin = 'http://127.0.0.1:5173';
test('放弃HTTP：原因校验、422、幂等、重建及中文审计', async () => {
  const c = await catalogFixture();
  try {
    const app = createApp(c.db, [origin], true),
      web = request.agent(app);
    await web
      .post('/api/v1/auth/login')
      .send({ username: 'owner', password: 'test-only-password', channel: 'web' })
      .expect(200);
    const v = (await upload(c.db, '规格 HTTP-ABANDON 300')).version!,
      key = randomUUID();
    const post = (body: object, idem = randomUUID()) =>
      web
        .post(`/api/v1/catalog/versions/${v.versionId}/abandon`)
        .set('Origin', origin)
        .set('Idempotency-Key', idem)
        .send(body);
    for (const body of [{}, { reason: ' ' }, { reason: '长'.repeat(501) }]) await post(body).expect(422);
    const first = await post({ reason: '页面录入错误' }, key).expect(200);
    assert.deepEqual((await post({ reason: '页面录入错误' }, key).expect(200)).body.data, first.body.data);
    await post({ reason: '另一请求' }).expect(422);
    await post({ reason: '修改正文' }, key).expect(409);
    const detail = catalogVersionSchema.parse(
      (await web.get(`/api/v1/catalog/versions/${v.versionId}`).expect(200)).body.data,
    );
    assert.equal(detail.abandonment?.actor, 'owner');
    assert.equal(detail.status, 'abandoned');
    const publish = await web
      .post(`/api/v1/catalog/versions/${v.versionId}/publish`)
      .set('Origin', origin)
      .set('Idempotency-Key', randomUUID())
      .send({ baseRevision: v.baseRevision, contentSha256: v.contentSha256 })
      .expect(422);
    assert.equal(publish.body.message, '该候选已放弃，请重建候选');
    const rebuilt = await web
      .post(`/api/v1/catalog/versions/${v.versionId}/rebuild`)
      .set('Origin', origin)
      .set('Idempotency-Key', randomUUID())
      .send({})
      .expect(200);
    assert.ok(rebuilt.body.data.version.versionId > v.versionId);
    const audit = await c.db.get("SELECT projection_json FROM operation_log WHERE action='catalog.abandon'");
    assert.match(JSON.stringify(audit?.projection_json), /待发布/);
    assert.match(JSON.stringify(audit?.projection_json), /已放弃/);
    assert.match(JSON.stringify(audit?.projection_json), /页面录入错误/);
  } finally {
    await c.dispose();
  }
});

test('候选新增接口均需登录及Web渠道', async () => {
  const c = await catalogFixture();
  try {
    const paths = ['/catalog/versions/1', '/catalog/versions/1/handoffs'];
    for (const path of paths) await c.api.get(`/api/v1${path}`).expect(401);
    for (const action of ['abandon', 'rebuild'])
      await c.api.post(`/api/v1/catalog/versions/1/${action}`).send({}).expect(401);
    for (const channel of ['pda', 'miniapp']) {
      const login = await c.api
        .post('/api/v1/auth/login')
        .send({ username: 'owner', password: 'test-only-password', channel })
        .expect(200);
      const token = String(login.body.data.token);
      for (const path of paths) await c.api.get(`/api/v1${path}`).auth(token, { type: 'bearer' }).expect(403);
      for (const action of ['abandon', 'rebuild'])
        await c.api.post(`/api/v1/catalog/versions/1/${action}`).auth(token, { type: 'bearer' }).send({}).expect(403);
    }
  } finally {
    await c.dispose();
  }
});
