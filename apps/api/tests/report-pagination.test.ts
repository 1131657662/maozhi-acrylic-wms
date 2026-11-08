import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { type ExportRequest } from '@wms/contracts';
import { reportFixture, reportParams } from './report-fixture.ts';
import { seedReportPerformance } from '../../../scripts/report-performance-fixture.ts';
import { waitExport, workbook } from './export-fixture.ts';
import { actor } from './fixture.ts';

test('B3b: monotone ledger keyset preserves ascending/descending export order across three batches', async () => {
  const f = await reportFixture();
  try {
    await seedReportPerformance(f.db, 2105);
    const ids = (
      await f.db.all(
        "SELECT id FROM stock_journal WHERE product_code='PERF-REPORT' AND source_business_type='inbound' ORDER BY id",
      )
    ).map((r) => String(r.id));
    for (const direction of ['asc', 'desc']) {
      const query = { ...reportParams, product: 'PERF-REPORT', page: '3', pageSize: '20', direction };
      const current = (await f.api.get('/api/v1/web/reports/details').query(query).set('Cookie', f.cookie).expect(200))
        .body.data;
      const input: ExportRequest = {
        requestId: randomUUID(),
        kind: 'report-details',
        scope: 'all',
        query,
        columns: ['id', 'weightGrams'],
        viewToken: current.viewToken,
        selected: [],
      };
      const job = await f.service.create(input, actor);
      assert.equal((await waitExport(f, job.id)).state, 'ready');
      const { sheet } = await workbook(f, job.id),
        actual = Array.from({ length: 2105 }, (_, i) => String(sheet.getCell(i + 2, 1).value));
      assert.deepEqual(actual, direction === 'asc' ? ids : [...ids].reverse());
      console.log('B3B_KEYSET', JSON.stringify({ direction, rows: actual.length, duplicates: 0, last: actual.at(-1) }));
    }
  } finally {
    await f.dispose();
  }
});
