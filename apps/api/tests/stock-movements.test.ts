import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import {
  stockMovementPageSchema,
  stockPeekSchema,
  stockPeekInputSchema,
  stockMovementQuerySchema,
} from '@wms/contracts';
import { numberingFixture } from './numbering-fixture.ts';
import { agingCell, agingMovement } from './stock-aging-fixture.ts';
import { readStockPeek } from '../src/features/stock/peek.ts';
import { inventorySnapshot } from './inventory-fixture.ts';

test('50/100/200 仓品 Peek 一次只读查询返回各自最近三条且保留空组合', async (t) => {
  const c = await numberingFixture();
  try {
    const prefix = `PEEK-${randomUUID().slice(0, 8)}`;
    const pairs = Array.from({ length: 200 }, (_, index) => ({
      warehouseCode: 'DEMO-WH',
      productCode: `${prefix}-${index.toString().padStart(3, '0')}`,
    }));
    for (const pair of pairs) await agingCell(c.db, pair.productCode);
    const cell = pairs[0]!;
    let before = 0;
    for (let index = 0; index < 4; index++) {
      const delta = (index + 1) * 100;
      await agingMovement(c.db, cell, { before, delta, type: 'stock.adjust' });
      before += delta;
    }
    await agingMovement(c.db, cell, { before, delta: 900, deleted: 1, type: 'stock.adjust' });
    const snapshot = await inventorySnapshot(c.db);
    for (const size of [50, 100, 200]) {
      const all = t.mock.method(c.db, 'all');
      const run = t.mock.method(c.db, 'run');
      const rows = await readStockPeek(c.db, pairs.slice(0, size));
      assert.equal(all.mock.callCount(), 1);
      assert.equal(run.mock.callCount(), 0);
      assert.equal(rows.length, size);
      assert.deepEqual(
        rows[0]!.items.map((row) => row.weightDeltaGrams),
        [400, 300, 200],
      );
      t.mock.restoreAll();
      console.log(`B6F2C_SQL pairs=${size} read=1 write=0`);
    }
    const response = await c.web
      .post('/api/v1/stock/peek')
      .set('Origin', 'http://127.0.0.1:5173')
      .send(pairs)
      .expect(200);
    const rows = stockPeekSchema.parse(response.body.data);
    assert.equal(rows.length, 200);
    assert.equal(rows[0]!.items.length, 3);
    assert.equal(rows[0]!.items[0]!.packagesDelta, 0);
    assert.deepEqual(rows[1]!.items, []);
    assert.deepEqual(Object.keys(rows[0]!.items[0]!).sort(), [
      'createdAt',
      'evidence',
      'id',
      'packagesDelta',
      'type',
      'weightDeltaGrams',
    ]);
    assert.deepEqual(await inventorySnapshot(c.db), snapshot);
    await c.web
      .post('/api/v1/stock/peek')
      .set('Origin', 'http://127.0.0.1:5173')
      .send([...pairs, { warehouseCode: 'DEMO-WH', productCode: `${prefix}-200` }])
      .expect(422);
  } finally {
    t.mock.restoreAll();
    await c.dispose();
  }
});

test('库存流水按仓品精确过滤并分页', async () => {
  const c = await numberingFixture();
  try {
    const cell = await agingCell(c.db);
    let before = 0;
    for (let index = 0; index < 25; index++) {
      await agingMovement(c.db, cell, { before, delta: 1000, type: 'stock.adjust' });
      before += 1000;
    }
    const other = await agingCell(c.db);
    await agingMovement(c.db, other, { before: 0, delta: 1000, type: 'stock.adjust' });
    const otherWarehouse = await agingCell(c.db, cell.productCode, 'OTHER-WH');
    await agingMovement(c.db, otherWarehouse, { before: 0, delta: 2000, type: 'stock.adjust' });
    await agingMovement(c.db, cell, { before, delta: 900, deleted: 1, type: 'stock.adjust' });
    const excluded = await agingCell(c.db);
    await agingMovement(c.db, excluded, { before: 0, delta: 3000, type: 'stock.adjust' });
    await c.db.run('UPDATE master_products SET inventory_eligible=0 WHERE code=?', [excluded.productCode]);
    const firstResponse = await c.web
      .get('/api/v1/stock/movements')
      .query({ warehouseCode: cell.warehouseCode, productCode: cell.productCode, page: 1, pageSize: 20 })
      .expect(200);
    const first = stockMovementPageSchema.parse(firstResponse.body.data);
    assert.equal(first.total, 25);
    assert.equal(first.items.length, 20);
    assert.ok(
      first.items.every((row) => row.warehouseCode === cell.warehouseCode && row.productCode === cell.productCode),
    );
    assert.equal(first.items[0]!.operationType, 'stock.adjust');
    assert.match(first.items[0]!.evidence.href, /warehouseCode=.*productCode=/);
    const secondResponse = await c.web
      .get('/api/v1/stock/movements')
      .query({ warehouseCode: cell.warehouseCode, productCode: cell.productCode, page: 2, pageSize: 20 })
      .expect(200);
    const second = stockMovementPageSchema.parse(secondResponse.body.data);
    assert.equal(second.total, 25);
    assert.equal(second.items.length, 5);
    assert.equal(new Set([...first.items, ...second.items].map((row) => row.id)).size, 25);
    const byWarehouse = await c.web
      .get('/api/v1/stock/movements')
      .query({ warehouseCode: cell.warehouseCode, page: 1, pageSize: 100 })
      .expect(200);
    assert.equal(stockMovementPageSchema.parse(byWarehouse.body.data).total, 26);
  } finally {
    await c.dispose();
  }
});

test('流水查询与 Peek 拒绝空组合、重复组合、超限及不支持的条件', () => {
  const pair = { warehouseCode: 'DEMO-WH', productCode: 'ACR-032' };
  for (const input of [[], [pair, pair], [{ ...pair, warehouseCode: '' }], [{ ...pair, productCode: 'x'.repeat(81) }]])
    assert.equal(stockPeekInputSchema.safeParse(input).success, false);
  for (const input of [{ page: 0 }, { pageSize: 300 }, { productCode: '' }, { from: '2026-11-01' }])
    assert.equal(stockMovementQuerySchema.safeParse(input).success, false);
});
