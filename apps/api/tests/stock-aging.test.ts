import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Database } from '../src/db/mysql.ts';
import { numberingFixture } from './numbering-fixture.ts';
import { readStock } from './stock-pending-fixture.ts';
import { agingCell, agingMovement } from './stock-aging-fixture.ts';

test('库存库龄五档边界按本页仓品隔离，所有行严格对平在库并排除软删流水', async () => {
  const c = await numberingFixture();
  try {
    const cell = await agingCell(c.db);
    let before = 0;
    for (const days of [181, 180, 91, 90, 61, 60, 31, 30, 0]) {
      await agingMovement(c.db, cell, { before, delta: 100_100, days });
      before += 100_100;
    }
    await agingMovement(c.db, cell, { before, delta: 100_000, deleted: 1 });
    await c.db.run(`INSERT INTO master_warehouses(code,name,created_at,updated_at)
      VALUES('AGE-W2','库龄第二仓',UTC_TIMESTAMP(3),UTC_TIMESTAMP(3))`);
    const second = await agingCell(c.db, cell.productCode, 'AGE-W2');
    await agingMovement(c.db, second, { before: 0, delta: 200_200, days: 61 });
    const page = await readStock(c.web, { product: cell.productCode });
    assert.equal(page.items.length, 2);
    assert.deepEqual(
      page.items.find((row) => row.warehouseCode === cell.warehouseCode)!.agingBuckets,
      [200_200, 200_200, 200_200, 200_200, 100_100],
    );
    assert.deepEqual(
      page.items.find((row) => row.warehouseCode === second.warehouseCode)!.agingBuckets,
      [0, 0, 200_200, 0, 0],
    );
    for (const row of page.items) {
      assert.equal(row.unagingGrams, 0);
      assert.equal(
        row.agingBuckets.reduce((sum, grams) => sum + grams, row.unagingGrams),
        row.onHand.weightGrams,
      );
    }
  } finally {
    await c.dispose();
  }
});

test('库龄与在库同一快照，并发调整只能在下一次列表同时出现', async (t) => {
  const c = await numberingFixture();
  try {
    const cell = await agingCell(c.db);
    await agingMovement(c.db, cell, { before: 0, delta: 1_000_000, days: 31 });
    const original = Database.prototype.all;
    let changed = false;
    t.mock.method(Database.prototype, 'all', async function (this: Database, ...args: Parameters<Database['all']>) {
      const rows = await original.apply(this, args);
      if (!changed && args[0].startsWith('SELECT COUNT(*) AS total FROM stock')) {
        changed = true;
        await c.db.transaction((tx) =>
          agingMovement(tx, cell, { before: 1_000_000, delta: 100_000, type: 'stock.adjust' }),
        );
      }
      return rows;
    });
    const first = await readStock(c.web, { product: cell.productCode });
    assert.equal(changed, true);
    assert.deepEqual(first.items[0]!.agingBuckets, [0, 1_000_000, 0, 0, 0]);
    assert.equal(first.items[0]!.onHand.weightGrams, 1_000_000);
    assert.equal(first.items[0]!.unagingGrams, 0);
    const next = await readStock(c.web, { product: cell.productCode });
    assert.deepEqual(next.items[0]!.agingBuckets, [0, 0, 0, 0, 0]);
    assert.equal(next.items[0]!.unagingGrams, 1_100_000);
    assert.equal(next.items[0]!.onHand.weightGrams, 1_100_000);
    assert.notEqual(first.watermark, next.watermark);
    assert.equal(first.watermark, first.viewToken);
  } finally {
    t.mock.restoreAll();
    await c.dispose();
  }
});
