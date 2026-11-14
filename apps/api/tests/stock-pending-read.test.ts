import { test } from 'node:test';
import assert from 'node:assert/strict';
import { webStockQuerySchema } from '@wms/contracts';
import { Database } from '../src/db/mysql.ts';
import { listWebStock } from '../src/features/web-lists/stock.ts';
import { numberingFixture } from './numbering-fixture.ts';
import { seedListEvidence } from '../../../scripts/e2e-list-fixtures.ts';
import { pendingPlan, readStock } from './stock-pending-fixture.ts';

test('50 行库存只执行一次待发和一次库龄批量 SQL，查询条数不随行数增加', async (t) => {
  const c = await numberingFixture();
  try {
    await seedListEvidence(c.db, 60);
    const all = Database.prototype.all,
      run = Database.prototype.run;
    const reads: string[] = [],
      controls: string[] = [];
    t.mock.method(Database.prototype, 'all', async function (this: Database, ...args: Parameters<Database['all']>) {
      reads.push(args[0]);
      return all.apply(this, args);
    });
    t.mock.method(Database.prototype, 'run', async function (this: Database, ...args: Parameters<Database['run']>) {
      controls.push(args[0]);
      return run.apply(this, args);
    });
    for (const pageSize of [20, 50]) {
      reads.length = 0;
      controls.length = 0;
      const page = await listWebStock(
        c.db,
        webStockQuerySchema.parse({ scope: 'inventory', product: 'WL-P', pageSize }),
      );
      assert.equal(page.items.length, pageSize);
      assert.equal(reads.filter((sql) => sql.startsWith('WITH selected_lines')).length, 1);
      assert.equal(reads.filter((sql) => sql.includes('/* stock-aging-batch */')).length, 1);
      assert.equal(reads.length, 7);
      assert.equal(controls.length, 3);
      console.log(`B6F2B_SQL rows=${pageSize} select=7 pending_batch=1 aging_batch=1 transaction=3 total=10`);
    }
  } finally {
    t.mock.restoreAll();
    await c.dispose();
  }
});

test('库存分页、原排序和全筛选 subtotal 与独立原库存聚合一致', async () => {
  const c = await numberingFixture();
  try {
    await seedListEvidence(c.db, 60);
    const expected = await c.db.all(
      "SELECT warehouse_code,product_code,packages,weight_tonnes FROM stock WHERE product_code LIKE 'WL-P%' ORDER BY product_code DESC",
    );
    const first = await readStock(c.web, { product: 'WL-P', pageSize: 50, sortBy: 'productCode', direction: 'desc' });
    const second = await readStock(c.web, {
      product: 'WL-P',
      page: 2,
      pageSize: 50,
      sortBy: 'productCode',
      direction: 'desc',
    });
    assert.equal(first.total, 60);
    assert.deepEqual(first.subtotal, { packages: 120, weightGrams: 36000000 });
    assert.deepEqual(second.subtotal, first.subtotal);
    assert.deepEqual(
      [...first.items, ...second.items].map((r) => [r.warehouseCode, r.productCode, r.packages, r.weightGrams]),
      expected.map((r) => [r.warehouse_code, r.product_code, r.packages, Number(r.weight_tonnes) * 1000000]),
    );
    const repeat = await readStock(c.web, { product: 'WL-P', pageSize: 50, sortBy: 'productCode', direction: 'desc' });
    assert.equal(repeat.viewToken, first.viewToken);
    assert.equal(repeat.watermark, first.watermark);
    assert.deepEqual(repeat.rowTokens, first.rowTokens);
    assert.ok(Date.parse(repeat.asOf) >= Date.parse(first.asOf));
  } finally {
    await c.dispose();
  }
});

test('库存与待发使用同一读快照，并发提交留到下一次读取', async (t) => {
  const c = await numberingFixture();
  try {
    await c.db.run("UPDATE outbound_orders SET status='voided' WHERE id LIKE 'DEMO-%'");
    const id = await pendingPlan(c.db, { packages: 5 });
    const original = Database.prototype.all;
    let changed = false;
    t.mock.method(Database.prototype, 'all', async function (this: Database, ...args: Parameters<Database['all']>) {
      const rows = await original.apply(this, args);
      if (!changed && args[0].startsWith('SELECT COUNT(*) AS total FROM stock')) {
        changed = true;
        await c.db.transaction(async (tx) => {
          await tx.run('UPDATE outbound_lines SET planned_packages=9 WHERE id=?', [id]);
          await tx.run("UPDATE stock SET packages=50 WHERE warehouse_code='DEMO-WH' AND product_code='ACR-032'");
        });
      }
      return rows;
    });
    const before = await readStock(c.web);
    assert.equal(changed, true);
    assert.equal(before.items[0]!.pending.packages, 5);
    assert.notEqual(before.items[0]!.onHand.packages, 50);
    const after = await readStock(c.web);
    assert.equal(after.items[0]!.pending.packages, 9);
    assert.equal(after.items[0]!.onHand.packages, 50);
    assert.notEqual(after.watermark, before.watermark);
  } finally {
    t.mock.restoreAll();
    await c.dispose();
  }
});
