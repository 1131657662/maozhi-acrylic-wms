import { reportBalanceSchema } from '@wms/contracts';
import type { Cell } from './types.ts';
import { addExact } from './arithmetic.ts';
export function totalBalance(cells: Cell[]) {
  const rows = cells.map((c) => c.periods.get('range')!);
  const keys = [
    'openingPackages',
    'openingGrams',
    'inboundPackages',
    'inboundGrams',
    'outboundPackages',
    'outboundGrams',
    'adjustmentPackages',
    'adjustmentGrams',
    'closingPackages',
    'closingGrams',
    'differencePackages',
    'differenceGrams',
  ] as const;
  const values = Object.fromEntries(
    keys.map((key) => [key, rows.some((r) => r[key] === null) ? null : addExact(...rows.map((r) => r[key]!))]),
  );
  const reasons = [...new Set(rows.flatMap((r) => r.reasons))];
  return reportBalanceSchema.parse({
    ...values,
    checkState: reasons.length ? '不可验证' : '可验证',
    reasons: reasons.slice(0, 12),
  });
}
