import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { fixture, fact, actor, confirmScannedFixture } from './fixture.ts';
import { addV1Fixture } from './catalog-fixture.ts';
import { getOrder } from '../src/features/outbound/repository.ts';
import { recordFact } from '../src/features/scan/service.ts';
import { freezePlan } from '../src/features/scan/freeze.ts';
import { reopenScan } from '../src/features/scan/reopen.ts';

test('80 scans against plan 100 close and reopen without stock changes, with idempotent audit', async () => {
  const c = await fixture();
  try {
    await c.db.run("UPDATE outbound_lines SET planned_packages=100 WHERE order_id='DEMO-001'");
    const stock = await c.db.all('SELECT * FROM stock');
    for (let i = 0; i < 80; i++) {
      const barcode = `CLOSE-${i}`;
      await addV1Fixture(c.db, { barcode, product: 'ACR-032', tonnes: '0.3025' });
      await recordFact(c.db, { planId: 'DEMO-001', fact: fact({ barcode }), actor });
    }
    const plan = await getOrder(c.db, 'DEMO-001');
    const command = { planId: plan.id, key: randomUUID(), expected: plan, actor };
    const closed = await freezePlan(c.db, command);
    assert.equal(closed.status, 'open');
    assert.ok(closed.scanClosedAt);
    assert.equal(closed.scanPackages, 80);
    assert.equal(closed.plannedPackages, 100);
    assert.deepEqual(await freezePlan(c.db, command), closed);
    await assert.rejects(recordFact(c.db, { planId: plan.id, fact: fact(), actor }), { code: 'PLAN_CLOSED' });
    const reopen = { ...command, key: randomUUID(), expected: closed };
    const opened = await reopenScan(c.db, reopen);
    assert.equal(opened.scanClosedAt, null);
    assert.equal(opened.status, 'open');
    assert.deepEqual(await reopenScan(c.db, reopen), opened);
    await recordFact(c.db, { planId: plan.id, fact: fact(), actor });
    const closedAgain = await freezePlan(c.db, {
      ...command,
      key: randomUUID(),
      expected: await getOrder(c.db, plan.id),
    });
    assert.ok(closedAgain.scanClosedAt);
    assert.deepEqual(await c.db.all('SELECT * FROM stock'), stock);
    assert.equal((await c.db.all("SELECT id FROM operation_log WHERE action='scan.reopen'")).length, 1);
    console.log('B4D_CLOSE planned=100 scans=80 status=open closed=true reopen=null reclose=true stock_unchanged=true');
  } finally {
    await c.dispose();
  }
});

test('scan reopen HTTP is authenticated Web-only and returns Chinese close result', async () => {
  const c = await fixture();
  try {
    const pda = await c.api
      .post('/api/v1/auth/login')
      .send({ username: 'owner', password: 'test-only-password', channel: 'pda' });
    const web = request.agent(c.app);
    await web
      .post('/api/v1/auth/login')
      .send({ username: 'owner', password: 'test-only-password', channel: 'web' })
      .expect(200);
    const before = await getOrder(c.db, 'DEMO-001');
    const closed = await c.api
      .post('/api/v1/scan/plans/DEMO-001/submit')
      .set('Authorization', `Bearer ${pda.body.data.token}`)
      .set('Idempotency-Key', randomUUID())
      .send({ revision: before.revision, digest: before.digest })
      .expect(200);
    assert.equal(closed.body.message, '已结束扫码');
    assert.equal(closed.body.data.status, 'open');
    const path = '/api/v1/outbound/DEMO-001/scan-reopen';
    const body = { revision: closed.body.data.revision, digest: closed.body.data.digest },
      key = randomUUID();
    await c.api.post(path).send(body).expect(401);
    await c.api.post(path).set('Authorization', `Bearer ${pda.body.data.token}`).send(body).expect(403);
    await web
      .post(path)
      .set('Origin', 'http://127.0.0.1:5173')
      .set('Idempotency-Key', key)
      .send({ ...body, unknown: 1 })
      .expect(422);
    const send = () =>
      web.post(path).set('Origin', 'http://127.0.0.1:5173').set('Idempotency-Key', key).send(body).expect(200);
    const responses = await Promise.all(Array.from({ length: 10 }, send));
    assert.ok(responses.every((r) => r.body.data.scanClosedAt === null));
    assert.equal((await c.db.all("SELECT id FROM operation_log WHERE action='scan.reopen'")).length, 1);
    console.log('B4D_REOPEN anonymous=401 pda=403 invalid=422 concurrent=10 success_events=1');
  } finally {
    await c.dispose();
  }
});

test('confirmation closes scanning automatically; reopening rejects shipped or non-open documents', async () => {
  const c = await fixture();
  try {
    const plan = await recordFact(c.db, { planId: 'DEMO-001', fact: fact(), actor });
    const confirmed = await confirmScannedFixture(c.db, { planId: plan.id, expected: plan, key: randomUUID(), actor });
    assert.ok(confirmed.scanClosedAt);
    const command = { planId: plan.id, expected: confirmed, key: randomUUID(), actor };
    await assert.rejects(reopenScan(c.db, command), { code: 'PLAN_CLOSED' });
    await assert.rejects(freezePlan(c.db, command), { code: 'PLAN_CLOSED' });
    await c.db.run("UPDATE outbound_orders SET status='open' WHERE id=?", [plan.id]);
    await assert.rejects(reopenScan(c.db, { ...command, expected: await getOrder(c.db, plan.id) }), {
      code: 'SHIPMENT_EXISTS',
    });
  } finally {
    await c.dispose();
  }
});
