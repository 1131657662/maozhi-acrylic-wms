import { test } from 'node:test';
import assert from 'node:assert/strict';
import { allocateScans } from '../src/features/outbound/scan-allocation.ts';

test('B4d rounding preserves totals on the last populated line; empty trailing lines stay zero', () => {
  const lines = [1, 2, 3, 4].map((id) => ({ id: String(id), productCode: 'P', plannedPackages: 1 }));
  const scans = [100, 100, 200].map((weightGrams) => ({ productCode: 'P', weightGrams }));
  const values = [...allocateScans(lines, scans).values()];
  assert.deepEqual(values, [
    { scanPackages: 1, scanWeightGrams: 100 },
    { scanPackages: 1, scanWeightGrams: 100 },
    { scanPackages: 1, scanWeightGrams: 200 },
    { scanPackages: 0, scanWeightGrams: 0 },
  ]);
  assert.equal(
    values.reduce((sum, row) => sum + row.scanWeightGrams, 0),
    400,
  );
});
