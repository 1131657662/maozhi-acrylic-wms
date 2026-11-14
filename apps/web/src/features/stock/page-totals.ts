import type { WebStockRow } from '@wms/contracts';

type Quantity = { packages?: number | null; weightGrams?: number | null };
export interface TotalableStock extends Quantity {
  pending?: Quantity | null;
  available?: Quantity | null;
}

export function sumPresent(values: readonly (number | null | undefined)[]): number | null {
  const present = values.filter((value): value is number => typeof value === 'number' && Number.isSafeInteger(value));
  if (!present.length) return null;
  const sum = Number(present.reduce((total, value) => total + BigInt(value), BigInt(0)));
  return Number.isSafeInteger(sum) ? sum : null;
}

export function stockPageTotals(rows: readonly TotalableStock[]) {
  const quantity = (key: 'pending' | 'available') => ({
    packages: sumPresent(rows.map((row) => row[key]?.packages)),
    weightGrams: sumPresent(rows.map((row) => row[key]?.weightGrams)),
  });
  return {
    packages: sumPresent(rows.map((row) => row.packages)),
    weightGrams: sumPresent(rows.map((row) => row.weightGrams)),
    pending: quantity('pending'),
    available: quantity('available'),
  } satisfies { [K in 'packages' | 'weightGrams']: WebStockRow[K] | null } & {
    pending: Quantity;
    available: Quantity;
  };
}
