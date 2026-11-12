import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { listFields, type ExportRequest, type ReportView } from '@wms/contracts';
import { restatedFixture, restatedQuery, appendDateCorrection } from './restated-fixture.ts';
import { waitExport, workbook } from './export-fixture.ts';
import { actor } from './fixture.ts';

function exportInput(current: { viewToken: string }, query: Record<string, string>): ExportRequest {
  return {
    requestId: randomUUID(),
    kind: 'report-monthly',
    scope: 'all',
    query,
    columns: listFields['report-monthly'].map((field) => field.key),
    viewToken: current.viewToken,
    selected: [],
  };
}
function expectedBridge(view: ReportView): unknown[][] {
  return view.bridge!.map((row) => [
    row.month ?? '未归期',
    row.category,
    row.inRange ? '是' : '否',
    row.postedPackages,
    row.postedGrams / 1_000_000,
    row.restatedPackages,
    row.restatedGrams / 1_000_000,
    row.deltaPackages,
    row.deltaGrams / 1_000_000,
    row.reason ?? '',
  ]);
}
test('B5d-2 export reuses query watermarks and bridge even after a later lower-UUID correction commits', async () => {
  const f = await restatedFixture();
  try {
    await appendDateCorrection(f.db);
    const query = { ...restatedQuery, fromDay: '2026-02-01', basis: 'restated' };
    const current = await f.read(query);
    await appendDateCorrection(f.db, 2);
    const job = await f.service.create(exportInput(current, query), actor),
      ready = await waitExport(f, job.id);
    assert.equal(ready.state, 'ready', ready.error ?? '');
    assert.deepEqual(ready.watermarks, current.watermarks);
    assert.deepEqual(ready.bridge, current.bridge);
    const { book } = await workbook(f, job.id),
      bridge = book.getWorksheet('归期桥接')!;
    const actual = expectedBridge(current).map((row, index) =>
      row.map((_, column) => bridge.getCell(index + 2, column + 1).value ?? ''),
    );
    assert.deepEqual(actual, expectedBridge(current));
    assert.ok(book.getWorksheet('报表口径')!.getCell(2, 2).text.includes('重述视图'));
    assert.equal((await f.read({ ...query, toDay: '2026-03-31' })).items[1]!.inboundPackages, 10);
  } finally {
    await f.dispose();
  }
});
test('B5d-2 export rejects changed query or missing snapshot instead of taking a fresh cutoff', async () => {
  const f = await restatedFixture();
  try {
    const current = await f.read();
    await assert.rejects(f.service.create(exportInput(current, { ...restatedQuery, basis: 'restated' }), actor), {
      code: 'EXPORT_VIEW_CHANGED',
    });
    await assert.rejects(f.service.create(exportInput({ viewToken: '0'.repeat(64) }, restatedQuery), actor), {
      code: 'EXPORT_VIEW_CHANGED',
    });
    const job = await f.service.create(
      exportInput(current, { ...restatedQuery, asOf: current.watermarks.asOf }),
      actor,
    );
    const ready = await waitExport(f, job.id);
    assert.equal(ready.state, 'ready', ready.error ?? '');
    assert.deepEqual(ready.watermarks, current.watermarks);
  } finally {
    await f.dispose();
  }
});
