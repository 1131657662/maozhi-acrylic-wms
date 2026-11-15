import test from 'node:test';
import assert from 'node:assert/strict';
import { reportMonthlySchema, type ReportMonthlyRow } from '@wms/contracts';
import { reportFixture, reportParams } from './report-fixture.ts';
import { restatedFixture, appendDateCorrection } from './restated-fixture.ts';
import { reportMasters } from '../../../scripts/report-fixtures.ts';

test('B7a-2 monthly aggregates all filtered rows independently of pagination and sorting', async () => {
  const f = await reportFixture();
  try {
    const read = async (params = {}) =>
      reportMonthlySchema.parse(
        (
          await f.api
            .get('/api/v1/web/reports/monthly')
            .query({ ...reportParams, ...params })
            .set('Cookie', f.cookie)
            .expect(200)
        ).body.data,
      );
    const full = await read();
    const page = await read({ pageSize: '20', page: '2', direction: 'desc' });
    assert.deepEqual(page.chart, full.chart);
    for (const point of full.chart.points) {
      const items = full.items.filter((row) => row.period === point.month);
      for (const key of ['inboundGrams', 'outboundGrams', 'netGrams'] as const)
        assert.equal(
          point[key],
          items.reduce((sum, row) => sum + row[key], 0),
        );
      assert.equal(point.netGrams, point.inboundGrams - point.outboundGrams);
    }
    for (const key of Object.keys(full.chart.totals) as (keyof typeof full.chart.totals)[])
      assert.equal(
        full.chart.totals[key],
        full.items.reduce((sum, row: ReportMonthlyRow) => sum + row[key], 0),
      );
    const short = await read({ fromDay: '2026-02-05', toDay: '2026-02-20' });
    assert.deepEqual(
      short.chart.points.map((point) => point.month),
      ['2026-02'],
    );
    assert.ok(short.items.every((row) => row.period === '2026-02'));
    const empty = await read({ product: 'no-such-chart-product' });
    assert.equal(empty.chart.empty, true);
    assert.deepEqual(empty.chart.points, []);
  } finally {
    await f.dispose();
  }
});

test('B7a-2 monthly chart follows restatement and historical asOf while details have no chart', async () => {
  const f = await restatedFixture();
  try {
    await appendDateCorrection(f.db);
    const posted = await f.read({ basis: 'posted' });
    const restated = await f.read({ basis: 'restated' });
    assert.deepEqual(
      posted.chart.points.map((point) => point.inboundGrams),
      [1234500, 0],
    );
    assert.deepEqual(
      restated.chart.points.map((point) => point.inboundGrams),
      [0, 1234500],
    );
    assert.deepEqual(
      restated.chart.points.map((point) => point.inboundDocuments),
      [0, 1],
    );
    assert.deepEqual(restated.chart.totals, posted.chart.totals);
    assert.equal(restated.watermarks.dateCorrectionMaxId, 'ffffffff-ffff-4fff-8fff-ffffffffffff');
    const earlier = await f.read({ basis: 'restated', asOf: '2026-02-28T23:00:00Z' });
    assert.deepEqual(
      earlier.chart.points.map((point) => point.inboundGrams),
      [1234500, 0],
    );
    assert.equal(earlier.watermarks.dateCorrectionMaxId, null);
    assert.equal('chart' in (await f.details()), false);
  } finally {
    await f.dispose();
  }
});

test('B7a-2 monthly document counts deduplicate the same document across product rows', async () => {
  const f = await restatedFixture();
  try {
    await reportMasters(f.db, 'RST-P2');
    // Same document, second product: quantities add; document count stays one.
    await f.db.run(`INSERT INTO stock_journal(warehouse_code,product_code,packages_delta,tonnes_delta,created_at,
      operation_id,inbound_receipt_id,packages_before,packages_after,tonnes_before,tonnes_after)
      SELECT warehouse_code,'RST-P2',packages_delta,tonnes_delta,created_at,operation_id,inbound_receipt_id,
        0,packages_delta,'0.0000',tonnes_delta FROM stock_journal WHERE inbound_receipt_id='B5D2-IN'`);
    await f.db.run(
      "INSERT INTO stock(warehouse_code,product_code,packages,weight_tonnes) VALUES('RST-W','RST-P2',10,'1.2345')",
    );
    const data = await f.read();
    assert.equal(data.chart.points[0]!.inboundDocuments, 1);
    assert.equal(data.chart.totals.inboundGrams, 2469000);
  } finally {
    await f.dispose();
  }
});
