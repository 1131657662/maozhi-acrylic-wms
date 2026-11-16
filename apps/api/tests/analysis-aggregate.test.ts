import test from 'node:test';
import assert from 'node:assert/strict';
import type { AnalysisQuery } from '@wms/contracts';
import type { LedgerEvent } from '../src/features/reports/types.ts';
import { heatmapSeries, movementAggregation } from '../src/features/analysis/aggregate.ts';

const query: AnalysisQuery = { fromDay: '2026-11-01', toDay: '2026-11-30', basis: 'posted' };

function event(input: {
  family: 'inbound' | 'outbound';
  productCode: string;
  partnerCode?: string | null;
  grams: number;
  localTime?: string | null;
}): LedgerEvent {
  return {
    family: input.family,
    productCode: input.productCode,
    partnerCode: input.partnerCode ?? null,
    weightGrams: input.grams,
    localTime: input.localTime === undefined ? '2026-11-03 12:00:00.000000' : input.localTime,
  } as LedgerEvent;
}

test('analysis aggregates effective flows and uses business-code tie breaks', () => {
  const result = movementAggregation(
    [
      event({ family: 'outbound', productCode: 'SKU-Z', partnerCode: 'CUS-B', grams: 500 }),
      event({ family: 'outbound', productCode: 'SKU-A', partnerCode: 'CUS-A', grams: 500 }),
      event({ family: 'inbound', productCode: 'SKU-A', partnerCode: 'SUP-B', grams: 300 }),
      event({ family: 'inbound', productCode: 'SKU-Z', partnerCode: 'SUP-A', grams: 300 }),
    ],
    query,
  );

  assert.deepEqual(
    result.tops.products.map((item) => item.code),
    ['SKU-A', 'SKU-Z'],
  );
  assert.deepEqual(
    result.tops.customers.map((item) => item.code),
    ['CUS-A', 'CUS-B'],
  );
  assert.deepEqual(
    result.tops.suppliers.map((item) => item.code),
    ['SUP-A', 'SUP-B'],
  );
  assert.equal(result.tops.products[0]?.rankedGrams, 500);
  assert.equal(result.tops.products[0]?.inboundGrams, 300);
  assert.equal(result.comparison.current.outboundGrams, 1000);
  assert.equal(result.monthly.length, 12);
});

test('analysis heatmap preserves verified zero separately from unknown dates', () => {
  const empty = heatmapSeries(movementAggregation([], query));
  assert.equal(empty.days.length, 183);
  assert.ok(empty.days.every((point) => point.value === 0));

  const unknown = heatmapSeries(
    movementAggregation([event({ family: 'outbound', productCode: 'SKU-A', grams: 100, localTime: null })], query),
  );
  assert.equal(unknown.days.length, 183);
  assert.ok(unknown.days.every((point) => point.value === null));
});

test('Top rankings only include the selected range', () => {
  const result = movementAggregation(
    [
      event({ family: 'outbound', productCode: 'SKU-A', grams: 100 }),
      event({ family: 'outbound', productCode: 'SKU-Z', grams: 999, localTime: '2026-10-31 23:59:59.000000' }),
    ],
    query,
  );
  assert.deepEqual(
    result.tops.products.map((item) => item.code),
    ['SKU-A'],
  );
});
