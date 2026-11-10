import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { fixture } from './fixture.ts';

const origin = 'http://127.0.0.1:5173';

async function loginWeb(app: Parameters<typeof request.agent>[0]) {
  const web = request.agent(app);
  await web
    .post('/api/v1/auth/login')
    .send({ username: 'owner', password: 'test-only-password', channel: 'web' })
    .expect(200);
  return web;
}

test('PDA 和小程序会话不能读取或修改仅限 Web 的业务资源', async () => {
  const { api, dispose } = await fixture();
  try {
    for (const channel of ['pda', 'miniapp']) {
      const login = await api
        .post('/api/v1/auth/login')
        .send({ username: 'owner', password: 'test-only-password', channel })
        .expect(200);
      const token = login.body.data.token as string;
      await api.get('/api/v1/inbound').auth(token, { type: 'bearer' }).expect(403);
      await api.get('/api/v1/master-data/products').auth(token, { type: 'bearer' }).expect(403);
      await api.post('/api/v1/inbound').auth(token, { type: 'bearer' }).send({}).expect(403);
      await api.post('/api/v1/inbound/anything/confirm').auth(token, { type: 'bearer' }).send({}).expect(403);
      await api.post('/api/v1/outbound/DEMO-001/confirm').auth(token, { type: 'bearer' }).send({}).expect(403);
      await api.post('/api/v1/stock/adjustments').auth(token, { type: 'bearer' }).send({}).expect(403);
      await api.post('/api/v1/outbound').auth(token, { type: 'bearer' }).send({}).expect(403);
      await api.patch('/api/v1/outbound/DEMO-001').auth(token, { type: 'bearer' }).send({}).expect(403);
    }
  } finally {
    await dispose();
  }
});

test('Web 同源会话可创建入库和出库计划并查询主数据', async () => {
  const { app, dispose } = await fixture();
  try {
    const web = await loginWeb(app);
    const master = await web
      .post('/api/v1/master-data/customers')
      .set('Origin', origin)
      .send({ name: 'HTTP 合成客户' })
      .expect(200);
    assert.equal(master.body.data.active, true);
    const masters = await web.get('/api/v1/master-data/customers').expect(200);
    assert.ok(masters.body.data.items.some((item: { code: string }) => item.code === master.body.data.code));

    const inbound = await web
      .post('/api/v1/inbound')
      .set('Origin', origin)
      .set('Idempotency-Key', randomUUID())
      .send({
        receiptNo: 'IN-HTTP-001',
        supplierCode: 'DEMO-SUPPLIER',
        warehouseCode: 'DEMO-WH',
        lines: [{ productCode: 'ACR-032', packages: 2, weightGrams: 701200 }],
      })
      .expect(200);
    assert.equal(inbound.body.data.packages, 2);
    assert.equal(inbound.body.data.weightGrams, 701200);
    assert.equal(
      (await web.get(`/api/v1/inbound/${inbound.body.data.id}`).expect(200)).body.data.lines[0].weightGrams,
      701200,
    );

    const planInput = {
      orderNo: 'OUT-HTTP-001',
      customerCode: 'DEMO-CUST-1',
      warehouseCode: 'DEMO-WH',
      vehicleNo: 'HTTP-TEST',
      lines: [{ productCode: 'ACR-032', plannedPackages: 1, plannedWeightGrams: 302500 }],
    };
    const plan = (
      await web
        .post('/api/v1/outbound')
        .set('Origin', origin)
        .set('Idempotency-Key', randomUUID())
        .send(planInput)
        .expect(200)
    ).body.data;
    const edited = await web
      .patch(`/api/v1/outbound/${plan.id}`)
      .set('Origin', origin)
      .set('Idempotency-Key', randomUUID())
      .send({ revision: plan.revision, digest: plan.digest, plan: { ...planInput, vehicleNo: 'HTTP-UPDATED' } })
      .expect(200);
    assert.equal(edited.body.data.vehicleNo, 'HTTP-UPDATED');
    const stock = await web.get('/api/v1/stock').expect(200);
    assert.equal(stock.body.data[0].packages, 6);
  } finally {
    await dispose();
  }
});

test('Web 写请求拒绝跨源或缺少同源校验', async () => {
  const { app, dispose } = await fixture();
  try {
    const web = await loginWeb(app);
    const body = { code: 'EVIL-CUST', name: '不应保存' };
    await web.post('/api/v1/master-data/customers').send(body).expect(403);
    await web.post('/api/v1/master-data/customers').set('Origin', 'https://example.invalid').send(body).expect(403);
  } finally {
    await dispose();
  }
});
