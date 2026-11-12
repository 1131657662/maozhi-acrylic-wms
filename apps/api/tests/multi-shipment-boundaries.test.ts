import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { shipmentFixture, shipmentBody, version } from './multi-shipment-fixture.ts';
import { inventorySnapshot } from './inventory-fixture.ts';

test('B5c-1 weight-only overage requires reason and package fulfilment alone cannot complete', async () => {
  const c = await shipmentFixture();
  try {
    const over = shipmentBody(await c.current(), 100, 30000100);
    await c.send(`${c.path}/shipments`, over).expect(422);
    await c.send(`${c.path}/shipments`, shipmentBody(await c.current(), 100, 29999900)).expect(200);
    const remaining = await c.send(`${c.path}/complete`, version(await c.current())).expect(422);
    assert.equal(remaining.body.data.lines[0].packages, 0);
    assert.equal(remaining.body.data.lines[0].weightGrams, 100);
    await c.send(`${c.path}/shipments`, shipmentBody(await c.current(), 0, 100)).expect(200);
    assert.equal((await c.current()).status, 'confirmed');
    await c.send(`${c.path}/complete`, version(await c.current())).expect(200);
  } finally {
    await c.dispose();
  }
});

test('B5c-1 stale plan, foreign lines, duplicate lines and unknown properties cannot mutate orders', async () => {
  const c = await shipmentFixture();
  try {
    const order = await c.current();
    await c.ship(40);
    await c.send(`${c.path}/plan`, { ...version(order), plan: { memo: '旧版本' } }, randomUUID(), 'patch').expect(409);
    const live = await c.current(),
      line = { id: live.lines[0]!.id, plannedPackages: 20, plannedWeightGrams: 6000000 };
    const before = await inventorySnapshot(c.db);
    await c
      .send(
        `${c.path}/plan`,
        { ...version(live), plan: { lines: [{ ...line, id: 'NOT-MY-LINE' }] } },
        randomUUID(),
        'patch',
      )
      .expect(422);
    await c
      .send(`${c.path}/plan`, { ...version(live), plan: { lines: [line, line] } }, randomUUID(), 'patch')
      .expect(422);
    await c
      .send(`${c.path}/plan`, { ...version(live), plan: { warehouseCode: 'OTHER' } }, randomUUID(), 'patch')
      .expect(422);
    assert.deepEqual(await inventorySnapshot(c.db), before);
    await c.send(`${c.path}/plan`, { ...version(live), plan: { lines: [line] } }, randomUUID(), 'patch').expect(200);
    assert.equal((await c.records()).remainingPackages, 0);
    assert.equal((await c.current()).actualPackages, 40);
    assert.equal((await c.current()).plannedPackages, 20);
  } finally {
    await c.dispose();
  }
});

test('B5c-1 shipment-specific vehicle and business date are immutable and do not rewrite plan header', async () => {
  const c = await shipmentFixture();
  try {
    await c
      .send(`${c.path}/shipments`, {
        ...shipmentBody(await c.current(), 40),
        vehicleNo: '第一车',
        businessDate: '2000-01-01',
      })
      .expect(422);
    await c
      .send(`${c.path}/shipments`, { ...shipmentBody(await c.current(), 40), businessDate: '2999-01-01' })
      .expect(422);
    await c
      .send(`${c.path}/shipments`, {
        ...shipmentBody(await c.current(), 40),
        vehicleNo: '第一车',
        businessDate: '2000-01-01',
        backdateConfirmed: true,
      })
      .expect(200);
    await c.ship(30);
    const rows = await c.records();
    assert.equal(rows.items[0]?.vehicleNo, '第一车');
    assert.equal(rows.items[0]?.businessDate, '2000-01-01');
    assert.equal(rows.items[1]?.vehicleNo, c.order.vehicleNo);
    assert.equal((await c.current()).vehicleNo, c.order.vehicleNo);
    const preview = await c.web.get(`/api/v1${c.path}/lifecycle`).expect(200);
    assert.equal(preview.body.data.allowed, true);
  } finally {
    await c.dispose();
  }
});
