import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { detailSchema } from '@wms/contracts';
import { shipmentFixture, version, type ShipmentFixture } from './multi-shipment-fixture.ts';
import { inventorySnapshot } from './inventory-fixture.ts';

async function edit(c: ShipmentFixture, packages: number, grams = packages * 300000) {
  const order = await c.current();
  return c.send(
    `${c.path}/plan`,
    {
      ...version(order),
      plan: { lines: [{ id: order.lines[0]!.id, plannedPackages: packages, plannedWeightGrams: grams }] },
    },
    randomUUID(),
    'patch',
  );
}
async function unchangedEvidence(c: ShipmentFixture) {
  return {
    shipments: (await c.records()).items,
    stock: await c.db.all('SELECT * FROM stock ORDER BY warehouse_code,product_code'),
    journal: await c.db.all('SELECT * FROM stock_journal ORDER BY id'),
    actual: (await c.current()).actualPackages,
  };
}

for (const planned of [120, 80]) {
  test(`B5c-1 plan 100 -> ${planned} after shipping 70 recalculates pending without changing inventory`, async () => {
    const c = await shipmentFixture();
    try {
      await c.ship(70);
      const before = await unchangedEvidence(c);
      assert.equal((await c.records()).remainingPackages, 30);
      assert.equal((await edit(c, planned)).status, 200);
      assert.equal((await c.records()).remainingPackages, planned - 70);
      assert.equal((await c.records()).remainingWeightGrams, (planned - 70) * 300000);
      assert.equal((await c.current()).status, 'partially_shipped');
      assert.deepEqual(await unchangedEvidence(c), before);
      const audit = await c.db.get(
        "SELECT before_json,after_json FROM operation_log WHERE target_id=? AND action='outbound.plan.update'",
        [c.order.id],
      );
      assert.equal(detailSchema.parse(JSON.parse(String(audit?.before_json))).lines[0]?.plannedPackages, 100);
      const after = detailSchema.parse(JSON.parse(String(audit?.after_json)));
      assert.equal(after.lines[0]?.plannedPackages, planned);
      assert.equal(after.lines[0]?.plannedWeightGrams, planned * 300000);
      console.log(
        `B5C1_PLAN_MIN before=100 shipped=70 new=${planned} remaining=${planned - 70} audit=true stock_unchanged=true`,
      );
    } finally {
      await c.dispose();
    }
  });
}

for (const input of [
  { packages: 60, grams: 24000000, field: 'plannedPackages' },
  { packages: 80, grams: 20000000, field: 'plannedWeightGrams' },
]) {
  test(`B5c-1 plan below shipped ${input.field} is 422 and identifies the row`, async () => {
    const c = await shipmentFixture();
    try {
      await c.ship(70);
      const before = await inventorySnapshot(c.db);
      const response = await edit(c, input.packages, input.grams);
      assert.equal(response.status, 422);
      assert.equal(response.body.data.lines[0].lineId, c.order.lines[0]!.id);
      assert.equal(response.body.data.fields[0].path, `plan.lines.0.${input.field}`);
      assert.deepEqual(await inventorySnapshot(c.db), before);
      console.log(`B5C1_PLAN_MIN below=${input.field} status=422 row_identified=true unchanged=true`);
    } finally {
      await c.dispose();
    }
  });
}

test('B5c-1 confirmed plan editing is 422 without mutation', async () => {
  const c = await shipmentFixture();
  try {
    await c.ship(100);
    const before = await inventorySnapshot(c.db);
    assert.equal((await edit(c, 120)).status, 422);
    assert.deepEqual(await inventorySnapshot(c.db), before);
    console.log('B5C1_PLAN_MIN confirmed_edit=422 unchanged=true');
  } finally {
    await c.dispose();
  }
});

test('B5c-1 plan editing rejects product, customer and warehouse replacement', async () => {
  const c = await shipmentFixture();
  try {
    await c.ship(70);
    const order = await c.current(),
      before = await inventorySnapshot(c.db);
    for (const plan of [
      { customerCode: 'OTHER' },
      { warehouseCode: 'OTHER' },
      { lines: [{ id: order.lines[0]!.id, productCode: 'OTHER', plannedPackages: 100, plannedWeightGrams: 30000000 }] },
    ])
      await c.send(`${c.path}/plan`, { ...version(order), plan }, randomUUID(), 'patch').expect(422);
    assert.deepEqual(await inventorySnapshot(c.db), before);
  } finally {
    await c.dispose();
  }
});
