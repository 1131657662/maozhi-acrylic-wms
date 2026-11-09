import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { listFields, type ExportRequest, type ReportKind } from '@wms/contracts';
import { derivedReportFixture } from './report-fixture.ts';
import { waitExport, workbook } from './export-fixture.ts';
import { actor } from './fixture.ts';

const cases = [
  {
    kind: 'report-turnover',
    path: '/api/v1/web/reports/turnover',
    query: {
      source: 'erp-product', fromDay: '2026-04-01', toDay: '2026-04-06', product: 'B3C-DAY',
      page: '1', pageSize: '20', sortBy: 'warehouseCode', direction: 'asc',
    },
    expected: '本期含调整 1 笔、含盘点回写 1 次',
  },
  {
    kind: 'report-aging',
    path: '/api/v1/web/reports/aging',
    query: {
      source: 'erp-product', fromDay: '2026-02-02', toDay: '2026-03-03', cutoffDay: '2026-03-03',
      product: 'B3C-COMP', page: '1', pageSize: '20', sortBy: 'warehouseCode', direction: 'asc',
    },
    expected: '本期含调整 0 笔、含盘点回写 0 次',
  },
] as const;

test('B3c: both derived XLSX reports place the exact period summary in the shared reconciliation position', async () => {
  const f = await derivedReportFixture();
  try {
    for (const entry of cases) await verifySummary(f, entry);
    console.log('B3C_XLSX_SUMMARY', JSON.stringify({ reports: 2, label: '本期库存变化说明', row: 3, differences: 0 }));
  } finally {
    await f.dispose();
  }
});

async function verifySummary(
  f: Awaited<ReturnType<typeof derivedReportFixture>>,
  entry: (typeof cases)[number],
): Promise<void> {
  const current = (await f.api.get(entry.path).query(entry.query).set('Cookie', f.cookie).expect(200)).body.data,
    kind = entry.kind as ReportKind;
  assert.equal(current.items[0]?.adjustmentSummary, entry.expected);
  const request: ExportRequest = {
    requestId: randomUUID(),
    kind,
    scope: 'all',
    query: entry.query,
    columns: listFields[kind].map((field) => field.key),
    viewToken: current.viewToken,
    selected: [],
  };
  const job = await f.service.create(request, actor),
    ready = await waitExport(f, job.id);
  assert.equal(ready.state, 'ready', ready.error ?? '');
  const { book } = await workbook(f, job.id), sheet = book.getWorksheet('收发存对账')!;
  assert.equal(sheet.getCell(3, 1).value, '本期库存变化说明');
  assert.equal(sheet.getCell(3, 2).value, entry.expected);
  assert.equal(sheet.getCell(3, 3).value, null);
}
