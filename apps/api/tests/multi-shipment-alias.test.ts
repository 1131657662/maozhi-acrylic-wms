import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { shipmentFixture, shipmentBody, version } from './multi-shipment-fixture.ts';

for (const endpoint of ['confirm', 'shipments']) {
  test(`B5c-1 ${endpoint} ships all 100 and auto-completes without a second click`, async () => {
    const c = await shipmentFixture();
    try {
      const key = randomUUID(),
        body = shipmentBody(await c.current(), 100);
      const result = await c.send(`${c.path}/${endpoint}`, body, key).expect(200);
      assert.equal(result.body.data.status, 'confirmed');
      const alias = endpoint === 'confirm' ? 'shipments' : 'confirm';
      const replay = await c.send(`${c.path}/${alias}`, body, key).expect(200);
      assert.deepEqual(replay.body.data, result.body.data);
      const records = await c.records();
      assert.equal(records.remainingPackages, 0);
      assert.equal(records.remainingWeightGrams, 0);
      assert.ok(records.completedAt);
      assert.equal(records.items.length, 1);
      assert.equal(
        Number((await c.db.get("SELECT COUNT(*) AS n FROM operation_log WHERE action='outbound.confirm'"))?.n),
        1,
      );
      console.log(
        `B5C1_ALIAS entry=${endpoint} actual=100 status=confirmed remaining=0 replay_via=${alias} shipments=1`,
      );
    } finally {
      await c.dispose();
    }
  });
  test(`B5c-1 ${endpoint} ships 40 and retains 60 pending; other alias shares concurrency and overage guards`, async () => {
    const c = await shipmentFixture();
    try {
      const body = shipmentBody(await c.current(), 40),
        key = randomUUID();
      const result = await c.send(`${c.path}/${endpoint}`, body, key).expect(200);
      assert.equal(result.body.data.status, 'partially_shipped');
      assert.equal((await c.records()).remainingPackages, 60);
      const alias = endpoint === 'confirm' ? 'shipments' : 'confirm';
      await c.send(`${c.path}/${alias}`, body).expect(409);
      await c.send(`${c.path}/${alias}`, shipmentBody(await c.current(), 61)).expect(422);
      const next = await c.send(`${c.path}/${alias}`, shipmentBody(await c.current(), 60)).expect(200);
      assert.equal(next.body.data.status, 'confirmed');
      assert.equal((await c.records()).items.length, 2);
      console.log(
        `B5C1_ALIAS entry=${endpoint} actual=40 status=partially_shipped remaining=60 then_${alias}=60 confirmed=true`,
      );
    } finally {
      await c.dispose();
    }
  });
}

test('B5c-1 explicit complete after plan reduction checks both remaining quantities and never posts inventory', async () => {
  const c = await shipmentFixture();
  try {
    await c.ship(40);
    const order = await c.current();
    await c
      .send(
        `${c.path}/plan`,
        {
          ...version(order),
          plan: { lines: [{ id: order.lines[0]!.id, plannedPackages: 40, plannedWeightGrams: 12000000 }] },
        },
        randomUUID(),
        'patch',
      )
      .expect(200);
    assert.equal((await c.current()).status, 'partially_shipped');
    const journals = await c.db.all('SELECT * FROM stock_journal ORDER BY id');
    await c.send(`${c.path}/complete`, version(await c.current())).expect(200);
    assert.equal((await c.current()).status, 'confirmed');
    assert.deepEqual(await c.db.all('SELECT * FROM stock_journal ORDER BY id'), journals);
    assert.equal(
      Number((await c.db.get("SELECT COUNT(*) AS n FROM operation_log WHERE action='outbound.complete'"))?.n),
      1,
    );
  } finally {
    await c.dispose();
  }
});
