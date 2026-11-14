import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { exportFixture, exportInput, waitExport, workbook } from './export-fixture.ts';
import { pendingPlan } from './stock-pending-fixture.ts';

for (const scope of ['all', 'page', 'selected'] as const) {
  test(`库存 ${scope} 导出保留旧列、顺序、数值，新增待发/可发和负号`, async () => {
    const c = await exportFixture(60);
    try {
      await pendingPlan(c.db, { product: 'WL-P000020', packages: 3, tonnes: '1.1000' });
      const { input, page } = await exportInput(c, 'stock', scope);
      input.columns.push('pending', 'available');
      if (scope === 'selected')
        input.selected = [page.items[0], page.items[3]].map((row: { id: string }) => ({
          id: row.id,
          token: page.rowTokens[row.id],
        }));
      const response = await c.api
        .post('/api/v1/web/exports')
        .set('Cookie', c.cookie)
        .set('Origin', 'http://localhost:5173')
        .send(input)
        .expect(202);
      const job = await waitExport(c, response.body.data.id);
      assert.equal(job.state, 'ready', job.error ?? '');
      const { sheet } = await workbook(c, job.id);
      const count = scope === 'all' ? 60 : scope === 'page' ? 20 : 2;
      assert.equal(sheet.rowCount, count + 2);
      assert.deepEqual((sheet.getRow(1).values as unknown[]).slice(1), [
        '商品名称',
        '商品编码',
        '库存包数',
        '库存重量（吨）',
        '仓库',
        '待发',
        '可发',
      ]);
      const expectedCodes =
        scope === 'all'
          ? Array.from({ length: 60 }, (_, i) => i)
          : scope === 'page'
            ? Array.from({ length: 20 }, (_, i) => i + 20)
            : [20, 23];
      for (const [index, code] of expectedCodes.entries()) {
        assert.equal(sheet.getCell(index + 2, 2).value, `WL-P${String(code).padStart(6, '0')}`);
        assert.equal(sheet.getCell(index + 2, 3).value, 2);
        assert.equal(sheet.getCell(index + 2, 4).value, 0.6);
      }
      const negativeRow = scope === 'all' ? 22 : 2;
      assert.equal(sheet.getCell(negativeRow, 6).value, '5 包 / 1.7000 吨');
      assert.equal(sheet.getCell(negativeRow, 7).value, '-3 包 / -1.1000 吨');
      assert.equal(Number(job.totals.packages), count * 2);
      assert.equal(Number(job.totals.weightGrams), count * 0.6);
    } finally {
      await c.dispose();
    }
  });
}

test('库存 CSV 新列保留后端负值及公式保护，读取时间变化不使导出失效', async () => {
  const c = await exportFixture(60);
  try {
    await pendingPlan(c.db, { product: 'WL-P000020', packages: 3, tonnes: '1.1000' });
    const { input } = await exportInput(c, 'stock', 'page');
    input.columns.push('pending', 'available');
    input.format = 'csv';
    const response = await c.api
      .post('/api/v1/web/exports')
      .set('Cookie', c.cookie)
      .set('Origin', 'http://localhost:5173')
      .send(input)
      .expect(202);
    const job = await waitExport(c, response.body.data.id);
    assert.equal(job.state, 'ready', job.error ?? '');
    const file = await c.service.download(job.id);
    const csv = await readFile(file.path, 'utf8');
    assert.ok(csv.includes("5 包 / 1.7000 吨,'-3 包 / -1.1000 吨"));
    assert.equal(job.processed, 20);
  } finally {
    await c.dispose();
  }
});
