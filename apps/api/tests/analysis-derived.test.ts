import test from 'node:test';
import assert from 'node:assert/strict';
import { analysisSchema, reportAgingSchema, reportTurnoverSchema } from '@wms/contracts';
import { derivedReportFixture } from './report-fixture.ts';

test('analysis aging and six-month turnover agree with report projections including stock-only unknowns', async () => {
  const f = await derivedReportFixture();
  try {
    const range = { fromDay: '2025-12-01', toDay: '2026-05-06', basis: 'posted' },
      read = async (path: string, params: object) =>
        (
          await f.api
            .get('/api/v1/web/' + path)
            .query(params)
            .set('Cookie', f.cookie)
            .expect(200)
        ).body.data,
      data = analysisSchema.parse(await read('analysis', range)),
      aging = reportAgingSchema.parse(
        await read('reports/aging', { ...range, scope: 'inventory', cutoffDay: range.toDay, asOf: data.asOf }),
      ),
      turnover = reportTurnoverSchema.parse(
        await read('reports/turnover', { ...range, scope: 'inventory', asOf: data.asOf }),
      );
    assert.deepEqual(data.aging.data, {
      buckets: aging.chart.buckets,
      unagedGrams: aging.chart.unagedGrams,
      closingGrams: aging.chart.closingGrams,
    });
    assert.deepEqual(
      data.turnover.data,
      turnover.chart.points.map(({ month, turns, turnoverDays, reasons }) => ({ month, turns, turnoverDays, reasons })),
    );
  } finally {
    await f.dispose();
  }
});

test('analysis never turns unknown source evidence into a verified zero or a missing reason', async () => {
  const f = await derivedReportFixture();
  try {
    await f.db.run("UPDATE master_products SET inventory_eligible=0 WHERE code='RPT-P1'");
    const data = analysisSchema.parse(
      (
        await f.api
          .get('/api/v1/web/analysis')
          .query({ fromDay: '2026-01-01', toDay: '2026-03-31' })
          .set('Cookie', f.cookie)
          .expect(200)
      ).body.data,
    );
    for (const key of ['monthly', 'comparison', 'tops', 'heatmap'] as const) {
      assert.equal(data[key].verification, 'unverifiable');
      assert.ok(data[key].reason);
    }
    assert.equal(data.tops.data, null);
    assert.equal(data.heatmap.data!.days.length, 183);
    assert.ok(data.heatmap.data!.days.every((day) => day.value === null));
  } finally {
    await f.dispose();
  }
});
