import { test } from 'node:test';
import assert from 'node:assert/strict';
import { numberingFixture } from './numbering-fixture.ts';
import { shipmentFixture, shipmentBody } from './multi-shipment-fixture.ts';
import { correctionInput } from './shipment-correction-fixture.ts';
import { pendingPlan, readStock } from './stock-pending-fixture.ts';

test('库存待发只累计对应仓库商品，保留负可发且不修改在库', async () => {
  const c = await numberingFixture();
  try {
    await c.db.run("UPDATE outbound_orders SET status='voided' WHERE id LIKE 'DEMO-%'");
    await c.db.run(
      "INSERT INTO master_warehouses(code,name,created_at,updated_at) VALUES('PENDING-W2','待发第二仓',UTC_TIMESTAMP(3),UTC_TIMESTAMP(3))",
    );
    await c.db.run(
      "INSERT INTO stock(warehouse_code,product_code,packages,weight_tonnes) VALUES('PENDING-W2','ACR-032',3,'1.0000')",
    );
    await pendingPlan(c.db, { packages: 5, tonnes: '2.0000' });
    await pendingPlan(c.db, { warehouse: 'PENDING-W2', packages: 7, tonnes: '1.5000' });
    const page = await readStock(c.web);
    assert.equal(page.items.length, 2);
    const first = page.items.find((row) => row.warehouseCode === 'DEMO-WH')!;
    const second = page.items.find((row) => row.warehouseCode === 'PENDING-W2')!;
    assert.deepEqual(first.pending, { packages: 5, weightGrams: 2000000 });
    assert.deepEqual(second.pending, { packages: 7, weightGrams: 1500000 });
    assert.deepEqual(second.onHand, { packages: 3, weightGrams: 1000000 });
    assert.deepEqual(second.available, { packages: -4, weightGrams: -500000 });
    const stock = await c.db.get("SELECT packages,weight_tonnes FROM stock WHERE warehouse_code='PENDING-W2'");
    assert.deepEqual(stock, { packages: 3, weight_tonnes: '1.0000' });
  } finally {
    await c.dispose();
  }
});

test('库存待发排除短关、已出库、作废、撤销与软删订单和明细', async () => {
  const c = await numberingFixture();
  try {
    await c.db.run("UPDATE outbound_orders SET status='voided' WHERE id LIKE 'DEMO-%'");
    for (const status of ['short_closed', 'confirmed', 'voided', 'cancelled']) await pendingPlan(c.db, { status });
    await pendingPlan(c.db, { deletedOrder: 1 });
    await pendingPlan(c.db, { deletedLine: 1 });
    await pendingPlan(c.db, { packages: 4, tonnes: '1.2000' });
    assert.deepEqual((await readStock(c.web)).items[0]!.pending, { packages: 4, weightGrams: 1200000 });
  } finally {
    await c.dispose();
  }
});

test('部分发货的待发包含每批实发与未抵消更正，和详情有效余额一致', async () => {
  const c = await shipmentFixture();
  try {
    await c.db.run("UPDATE outbound_orders SET status='voided' WHERE id LIKE 'DEMO-%'");
    await c.ship(20);
    await c.ship(30);
    assert.deepEqual((await readStock(c.web)).items[0]!.pending, { packages: 50, weightGrams: 15000000 });
    await c.send(`${c.path}/corrections`, await correctionInput(c, 1, 15)).expect(200);
    const row = (await readStock(c.web)).items[0]!;
    const detail = await c.records();
    assert.deepEqual(row.pending, { packages: 55, weightGrams: 16500000 });
    assert.equal(row.pending.packages, detail.remainingPackages);
    assert.equal(row.pending.weightGrams, detail.remainingWeightGrams);
    assert.deepEqual(row.available, { packages: 100, weightGrams: 30000000 });
  } finally {
    await c.dispose();
  }
});

test('同商品多行逐行取零，包数溢发不会抵销另一行待发或重量余额', async () => {
  const c = await shipmentFixture();
  try {
    await c.db.run("UPDATE outbound_orders SET status='voided' WHERE id LIKE 'DEMO-%'");
    await c.db.run(
      `INSERT INTO outbound_lines(id,order_id,product_code,product_name,planned_packages,planned_weight_tonnes,line_position)
      VALUES('pending-extra',?,'ACR-032','多行验收',20,'6.0000',1)`,
      [c.order.id],
    );
    const body = shipmentBody(await c.current(), 110, 20000000);
    await c
      .send(`${c.path}/shipments`, {
        ...body,
        lines: body.lines.map((line) => ({ ...line, overageReason: '包数溢发验收' })),
      })
      .expect(200);
    const row = (await readStock(c.web)).items[0]!;
    assert.deepEqual(row.pending, { packages: 20, weightGrams: 16000000 });
    assert.deepEqual(row.onHand, { packages: 90, weightGrams: 40000000 });
    assert.deepEqual(row.available, { packages: 70, weightGrams: 24000000 });
  } finally {
    await c.dispose();
  }
});
