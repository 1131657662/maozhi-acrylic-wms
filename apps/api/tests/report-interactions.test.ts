import test from 'node:test';
import assert from 'node:assert/strict';
import { reportDetailsSchema, reportMonthlySchema, reportAgingSchema } from '@wms/contracts';
import { derivedReportFixture, reportParams } from './report-fixture.ts';
import { cardDrilldown, chartDrilldown, rowDrilldown, canOpenStock } from '../../web/src/features/reports/drilldown.ts';

test('B7a-3 facets count report rows using other dimensions and keep full-type reconciliation', async () => {
  const f = await derivedReportFixture();
  try {
    const read = async (kind: string, extra = {}) =>
      (
        await f.api
          .get('/api/v1/web/reports/' + kind)
          .query({ ...reportParams, ...extra })
          .set('Cookie', f.cookie)
          .expect(200)
      ).body.data;
    const all = reportDetailsSchema.parse(await read('details'));
    const wh = all.facets.warehouses[0]!;
    assert.equal(wh.count, all.items.filter((row) => row.warehouseCode === wh.value).length);
    const filtered = reportDetailsSchema.parse(
      await read('details', { warehouseCodes: wh.value, movements: 'inbound', types: 'reversal' }),
    );
    assert.ok(filtered.items.every((row) => row.warehouseCode === wh.value && row.operationType === 'inbound.reverse'));
    assert.equal(filtered.facets.types.find((v) => v.value === 'reversal')!.count, filtered.total);
    const warehouseOnly = reportDetailsSchema.parse(await read('details', { warehouseCodes: wh.value }));
    assert.deepEqual(filtered.report.reconciliation, warehouseOnly.report.reconciliation);
    assert.equal(filtered.facets.movements.find((v) => v.value === 'outbound')!.count, 3);
    const union = reportDetailsSchema.parse(
      await read('details', { movements: 'inbound,outbound', types: 'inbound,outbound,reversal,correction' }),
    );
    assert.deepEqual(union.items, all.items);
    const monthly = reportMonthlySchema.parse(await read('monthly', { movements: 'inbound', types: 'reversal' }));
    assert.equal(monthly.total, 6);
    assert.equal(
      monthly.chart.totals.inboundGrams,
      filtered.items.reduce((n, row) => n + row.weightGrams, 0) * all.facets.warehouses.length,
    );
    assert.equal(monthly.chart.totals.outboundGrams, 0);
    assert.deepEqual(monthly.report.reconciliation, all.report.reconciliation);
    await f.api
      .get('/api/v1/web/reports/details')
      .query({ ...reportParams, types: '__proto__' })
      .set('Cookie', f.cookie)
      .expect(422);
    const query = { product: 'B3C', fromDay: '2026-02-02', toDay: '2026-03-02', cutoffDay: '2026-03-02' };
    const aging = reportAgingSchema.parse(await read('aging', query));
    for (const band of ['age0To30Grams', 'unagedGrams'] as const) {
      const selected = reportAgingSchema.parse(await read('aging', { ...query, band }));
      assert.deepEqual(
        selected.items,
        aging.items.filter((row) => row[band] !== null && row[band] !== 0),
      );
      for (const row of selected.items)
        assert.equal(
          row.closingGrams,
          [
            row.age0To30Grams,
            row.age31To90Grams,
            row.age91To180Grams,
            row.age181To365Grams,
            row.ageOver365Grams,
            row.unagedGrams,
          ].reduce<number>((sum, n) => sum + (n ?? 0), 0),
        );
    }
  } finally {
    await f.dispose();
  }
});

test('B7a-3 six drilldowns whitelist conditions, preserve basis, clip month and gate current stock', () => {
  const params = {
    fromDay: '2026-01-10',
    toDay: '2026-03-20',
    cutoffDay: '2026-03-20',
    basis: 'restated',
    warehouseCodes: 'A,B',
    product: '腈纶',
    movement: 'all',
    types: 'inbound,reversal',
    viewToken: 'must-not-copy',
    selected: 'must-not-copy',
  };
  const row = { period: '2026-01', warehouseCode: 'A', productCode: 'P', documentId: 'doc', directionLabel: '入库' };
  const urls = [
    rowDrilldown('report-monthly', params, row)!,
    rowDrilldown('report-turnover', params, row)!,
    chartDrilldown('aging', params, { name: '', seriesIndex: 5 }),
    rowDrilldown('report-details', params, row)!,
    cardDrilldown('monthly', params, 0),
  ];
  for (const href of urls) {
    const url = new URL(href, 'http://local');
    assert.equal(url.searchParams.get('basis'), 'restated');
    assert.ok(url.searchParams.has('fromDay'));
    assert.ok(!href.includes('must-not-copy'));
  }
  const monthly = new URL(urls[0]!, 'http://local');
  assert.equal(monthly.searchParams.get('fromDay'), '2026-01-10');
  assert.equal(monthly.searchParams.get('toDay'), '2026-01-31');
  assert.match(urls[1]!, /movement=outbound/);
  assert.match(urls[1]!, /drilldown=turnover/);
  assert.match(urls[2]!, /band=unagedGrams/);
  assert.equal(canOpenStock(params), false);
  assert.equal(rowDrilldown('report-aging', params, row), undefined);
  const today = new Date(Date.now() + 8 * 3600000).toISOString().slice(0, 10);
  assert.match(rowDrilldown('report-aging', { ...params, cutoffDay: today }, row)!, /^\/stock\?/);
});
