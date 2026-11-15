import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { listFields, reconciliationLines, type ExportRequest } from '@wms/contracts';
import { restatedFixture, restatedQuery, appendDateCorrection } from './restated-fixture.ts';
import { waitExport, workbook } from './export-fixture.ts';
import { actor } from './fixture.ts';
import { REPORT_HEADER_ROW } from '../src/features/web-exports/report-header.ts';

test('B7a-3 exports original screen rows and reconciliation after later posting with safe metadata and filename', async () => {
  const f = await restatedFixture();
  try {
    await appendDateCorrection(f.db);
    const query = { ...restatedQuery, basis: 'restated' };
    const current = await f.read(query);
    const input: ExportRequest = {
      requestId: randomUUID(),
      kind: 'report-monthly',
      scope: 'all',
      query,
      columns: listFields['report-monthly'].map((field) => field.key),
      viewToken: current.viewToken,
      selected: [],
    };
    // A later committed event and current balance change must not change this already viewed snapshot.
    await f.db
      .run(`INSERT INTO stock_journal(warehouse_code,product_code,packages_delta,tonnes_delta,created_at,packages_before,packages_after,tonnes_before,tonnes_after)
      SELECT warehouse_code,product_code,1,0.1000,UTC_TIMESTAMP(),packages,packages+1,weight_tonnes,weight_tonnes+0.1000 FROM stock WHERE product_code='RST-P'`);
    await f.db.run(
      "UPDATE stock SET packages=packages+1,weight_tonnes=weight_tonnes+0.1000 WHERE product_code='RST-P'",
    );
    const job = await f.service.create(input, actor);
    const ready = await waitExport(f, job.id);
    assert.equal(ready.state, 'ready', ready.error ?? '');
    const { book, sheet } = await workbook(f, job.id);
    assert.equal((await f.service.download(job.id)).name, `月度汇总_${query.fromDay}_${query.toDay}.xlsx`);
    const first = sheet.getCell(1, 1).text;
    for (const expected of [
      '月度汇总',
      '口径：重述',
      '重述视图 · 按有效业务日期',
      current.watermarks.asOf,
      `流水水位：${current.watermarks.journalMaxId}`,
      '日期更正：1 条',
      '生成时间：',
      '操作人：',
    ])
      assert.ok(first.includes(expected), expected);
    assert.match(sheet.getCell(2, 1).text, /日期范围.*仓库.*商品.*方向.*类型/);
    const columns = listFields['report-monthly'];
    for (const [i, row] of current.items.entries()) {
      for (const key of ['inboundGrams', 'outboundGrams', 'netGrams'] as const)
        assert.equal(
          sheet.getCell(i + REPORT_HEADER_ROW + 1, columns.findIndex((f) => f.key === key) + 1).value,
          row[key] / 1_000_000,
        );
    }
    for (const [i, line] of reconciliationLines(current.report.reconciliation).entries()) {
      const summary = book.getWorksheet('收发存对账')!;
      assert.equal(summary.getCell(i + 3, 2).value, line.packages ?? '—（不可验证）');
      assert.equal(
        summary.getCell(i + 3, 3).value,
        line.weightGrams === null ? '—（不可验证）' : line.weightGrams / 1_000_000,
      );
    }
    const text: string[] = [];
    for (const s of book.worksheets) s.eachRow((row) => row.eachCell((cell) => text.push(cell.text)));
    assert.ok(!text.join('\n').includes(current.viewToken));
    assert.doesNotMatch(text.join('\n'), /[0-9a-f]{8}-[0-9a-f-]{27}|viewToken|stock_journal|SELECT |\/api\//i);
    const closing = columns.findIndex((f) => f.key === 'closingGrams') + 1;
    assert.equal(sheet.getCell(sheet.rowCount, closing).text, '—');
  } finally {
    await f.dispose();
  }
});

test('B7a-3 expired report snapshot rejects HTTP export creation with 409 and refresh message', async (t) => {
  const f = await restatedFixture();
  try {
    const current = await f.read();
    const now = Date.now();
    t.mock.method(Date, 'now', () => now + 31 * 60_000);
    const response = await f.api
      .post('/api/v1/web/exports')
      .set('Cookie', f.cookie)
      .set('Origin', 'http://localhost:5173')
      .send({
        requestId: randomUUID(),
        kind: 'report-monthly',
        scope: 'all',
        query: restatedQuery,
        columns: ['period', 'inboundGrams'],
        viewToken: current.viewToken,
        selected: [],
      })
      .expect(409);
    assert.equal(response.body.message, '数据已变化，请刷新后重新导出');
  } finally {
    t.mock.restoreAll();
    await f.dispose();
  }
});
