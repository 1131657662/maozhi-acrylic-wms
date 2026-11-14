import { test } from 'node:test';
import assert from 'node:assert/strict';
import { stockPageTotals } from '../../web/src/features/stock/page-totals.ts';

test('本页合计逐列累加，零和负可发不丢失，不重算可发', () => {
  assert.deepEqual(
    stockPageTotals([
      {
        packages: 3,
        weightGrams: 100,
        pending: { packages: 5, weightGrams: 400 },
        available: { packages: -2, weightGrams: -300 },
      },
      {
        packages: 0,
        weightGrams: 200,
        pending: { packages: 0, weightGrams: 100 },
        available: { packages: 8, weightGrams: 100 },
      },
    ]),
    {
      packages: 3,
      weightGrams: 300,
      pending: { packages: 5, weightGrams: 500 },
      available: { packages: 6, weightGrams: -200 },
    },
  );
});

test('各维度独立忽略缺值，全缺值为 null 而有效零为 0', () => {
  assert.deepEqual(
    stockPageTotals([
      { packages: null, weightGrams: 0, pending: { packages: 2 } },
      { pending: { packages: null, weightGrams: 100 }, available: null },
    ]),
    {
      packages: null,
      weightGrams: 0,
      pending: { packages: 2, weightGrams: 100 },
      available: { packages: null, weightGrams: null },
    },
  );
  assert.equal(stockPageTotals([]).packages, null);
  assert.equal(stockPageTotals([{ packages: Number.MAX_SAFE_INTEGER }, { packages: 1 }]).packages, null);
});
