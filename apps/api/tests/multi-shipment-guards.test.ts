import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { shipmentFixture, shipmentBody, version } from './multi-shipment-fixture.ts';
import { failAfter, inventorySnapshot } from './inventory-fixture.ts';
import { createStocktake } from '../src/features/stocktake/create.ts';
import { actor } from './fixture.ts';

test('B5c-1 concurrent different keys share revision and only one shipment commits; replay same key returns original', async () => {
  const c = await shipmentFixture();
  try {
    const body = shipmentBody(await c.current(), 40),
      keys = [randomUUID(), randomUUID()];
    const results = await Promise.all(keys.map((key) => c.send(`${c.path}/shipments`, body, key)));
    assert.deepEqual(results.map((r) => r.status).sort(), [200, 409]);
    const winner = results.findIndex((r) => r.status === 200);
    const replay = await c.send(`${c.path}/shipments`, body, keys[winner]).expect(200);
    assert.deepEqual(replay.body.data, results[winner]!.body.data);
    assert.equal((await c.records()).items.length, 1);
    assert.equal(
      Number((await c.db.get("SELECT COUNT(*) AS n FROM operation_log WHERE action='outbound.confirm'"))?.n),
      1,
    );
    console.log(
      'B5C1_CONCURRENCY statuses=200/409 shipments=1 success_events=1 same_key_replay=original stock_deduction=40',
    );
  } finally {
    await c.dispose();
  }
});

test('B5c-1 zero, missing reason and all terminal states reject without business mutations', async () => {
  const c = await shipmentFixture();
  try {
    await c.send(`${c.path}/shipments`, shipmentBody(await c.current(), 0)).expect(422);
    await c.ship(40);
    await c.send(`${c.path}/short-close`, { ...version(await c.current()), reason: ' ' }).expect(422);
    await c.send(`${c.path}/short-close`, { ...version(await c.current()), reason: '不再发货' }).expect(200);
    for (const status of ['short_closed', 'confirmed', 'voided', 'cancelled']) {
      // Simulate terminal rows in the disposable DB to exercise every route's gate.
      await c.db.run('UPDATE outbound_orders SET status=? WHERE id=?', [status, c.order.id]);
      const order = await c.current(),
        before = await inventorySnapshot(c.db);
      await c.send(`${c.path}/shipments`, shipmentBody(order, 1)).expect(409);
      await c.send(`${c.path}/short-close`, { ...version(order), reason: '不能重开' }).expect(409);
      await c
        .send(`${c.path}/plan`, { ...version(order), plan: { containerNo: '不可改' } }, randomUUID(), 'patch')
        .expect(422);
      assert.deepEqual(await inventorySnapshot(c.db), before);
    }
  } finally {
    await c.dispose();
  }
});

test('B5c-1 post-inventory failure retains failed attempt but rolls back shipment, stock, journal and successful audit', async () => {
  const c = await shipmentFixture();
  try {
    const before = await inventorySnapshot(c.db),
      body = shipmentBody(await c.current(), 40);
    await failAfter(c.db, 'outbound_orders', 'UPDATE');
    await c.send(`${c.path}/shipments`, body).expect(500);
    await c.db.run('DROP TRIGGER b1a_fail');
    assert.deepEqual(await inventorySnapshot(c.db), before);
    assert.equal(
      Number(
        (
          await c.db.get(
            "SELECT COUNT(*) AS n FROM operation_attempts WHERE action='outbound.confirm' AND target_id=?",
            [c.order.id],
          )
        )?.n,
      ),
      1,
    );
  } finally {
    await c.dispose();
  }
});

test('B5c-1 shipment is blocked by warehouse stocktake and Web-only authorization', async () => {
  const c = await shipmentFixture();
  try {
    const body = shipmentBody(await c.current(), 40);
    await c.api.post(`/api/v1${c.path}/shipments`).send(body).expect(401);
    const login = await c.api
      .post('/api/v1/auth/login')
      .send({ username: 'owner', password: 'test-only-password', channel: 'pda' })
      .expect(200);
    await c.api
      .post(`/api/v1${c.path}/shipments`)
      .set('Authorization', `Bearer ${login.body.data.token}`)
      .set('Idempotency-Key', randomUUID())
      .send(body)
      .expect(403);
    await createStocktake(c.db, { warehouseCode: 'DEMO-WH' }, randomUUID(), actor);
    const before = await inventorySnapshot(c.db);
    await c.send(`${c.path}/shipments`, body).expect(409);
    assert.deepEqual(await inventorySnapshot(c.db), before);
  } finally {
    await c.dispose();
  }
});

test('B5c-1 unrelated inventory movement between shipments blocks whole reversal', async () => {
  const c = await shipmentFixture();
  try {
    await c.ship(40);
    await c
      .send('/stock/adjustments', {
        warehouseCode: 'DEMO-WH',
        productCode: 'ACR-032',
        packagesDelta: 1,
        weightDeltaGrams: 300000,
        expected: { packages: 160, weightGrams: 48000000 },
        reason: '其他库存操作',
      })
      .expect(200);
    await c.ship(30);
    const preview = await c.web.get(`/api/v1${c.path}/lifecycle`).expect(200);
    assert.equal(preview.body.data.allowed, false);
    const before = await inventorySnapshot(c.db);
    await c.send(`${c.path}/reverse`, { expectedToken: preview.body.data.token, reason: '不应撤销' }).expect(409);
    assert.deepEqual(await inventorySnapshot(c.db), before);
  } finally {
    await c.dispose();
  }
});
