import test from 'node:test';
import assert from 'node:assert/strict';
import { reportTurnoverSchema, reportAgingSchema } from '@wms/contracts';
import { derivedReportFixture } from './report-fixture.ts';
import { turnoverMetrics } from '../src/features/reports/turnover-metrics.ts';

test('B7a-2 turnover monthly numerators and inventory-days reconcile to the full range', async () => {
  const f = await derivedReportFixture();
  try {
    const read = async (params = {}) =>
      reportTurnoverSchema.parse(
        (
          await f.api
            .get('/api/v1/web/reports/turnover')
            .query({ source: 'erp-product', fromDay: '2026-04-01', toDay: '2026-05-06', product: 'B3C-DAY', ...params })
            .set('Cookie', f.cookie)
            .expect(200)
        ).body.data,
      );
    const data = await read();
    assert.deepEqual(
      data.chart.points.map((point) => point.month),
      ['2026-04', '2026-05'],
    );
    for (const key of ['netOutboundGrams', 'dailyClosingGramsSum'] as const) {
      assert.equal(
        data.chart.points.reduce((sum, point) => sum + point[key]!, 0),
        data.totals[key],
      );
      assert.equal(data.chart.totals[key], data.totals[key]);
    }
    const short = await read({ toDay: '2026-04-06' });
    assert.equal(short.chart.points.length, 1);
    assert.equal(short.chart.totals.turns, '0.4211');
    assert.equal(short.chart.totals.turnoverDays, '14.3');
    assert.equal(short.chart.totals.dailyClosingGramsSum, 57000000);
    assert.deepEqual(short.chart.points[0]!.turnoverDays, short.items[0]!.turnoverDays);
    const empty = await read({ product: 'no-such-chart-product' });
    assert.equal(empty.chart.empty, true);
    assert.equal(empty.chart.totals.turnoverDays, null);
  } finally {
    await f.dispose();
  }
});

test('B7a-2 aging chart preserves five buckets, unknown balances and a separate unaged segment', async () => {
  const f = await derivedReportFixture();
  try {
    const read = async (product: string) =>
      reportAgingSchema.parse(
        (
          await f.api
            .get('/api/v1/web/reports/aging')
            .query({
              source: 'erp-product',
              fromDay: '2026-02-02',
              toDay: '2026-03-03',
              cutoffDay: '2026-03-03',
              product,
            })
            .set('Cookie', f.cookie)
            .expect(200)
        ).body.data,
      );
    const data = await read('B3C-FIFO');
    assert.deepEqual(data.chart.buckets, [
      data.totals.age0To30Grams,
      data.totals.age31To90Grams,
      data.totals.age91To180Grams,
      data.totals.age181To365Grams,
      data.totals.ageOver365Grams,
    ]);
    assert.equal(
      data.chart.buckets.reduce<number>((sum, grams) => sum + grams!, 0) + data.chart.unagedGrams!,
      data.totals.closingGrams,
    );
    const unaged = await read('B3C-COMP');
    assert.deepEqual(unaged.chart.buckets, [null, null, null, null, null]);
    assert.equal(unaged.chart.unagedGrams, 5000000);
    assert.equal(unaged.chart.unagedGrams, unaged.totals.unagedGrams);
    assert.equal(unaged.chart.over90Percent, null);
    assert.ok(unaged.chart.reasons.some((reason) => reason.includes('无法归龄')));
    const empty = await read('no-such-chart-product');
    assert.equal(empty.chart.empty, true);
    assert.equal(empty.chart.closingGrams, null);
  } finally {
    await f.dispose();
  }
});

test('B7a-2 turnover totals recompute ratios and keep zero, negative, missing and incomplete cases distinct', () => {
  const metrics = (outbound: number | null, sum: number | null, days = 4) =>
    turnoverMetrics({ netOutboundGrams: outbound, dailyClosingGramsSum: sum }, days, []);
  assert.equal(metrics(10000000, 20000000).turns, '2.0000');
  assert.equal(metrics(10000000, 20000000).turnoverDays, '2.0');
  assert.equal(metrics(0, 20000000).turns, '0.0000');
  assert.equal(
    turnoverMetrics({ netOutboundGrams: 10, dailyClosingGramsSum: 20 }, 4, ['其中一项证据不足']).turns,
    null,
  );
  for (const data of [
    metrics(0, 20000000),
    metrics(0, 0),
    metrics(-1, 100),
    metrics(null, 100),
    metrics(1, null),
    metrics(1, 100, 0),
  ]) {
    assert.equal(data.turnoverDays, null);
    assert.ok(data.reasons.length > 0);
  }
});
