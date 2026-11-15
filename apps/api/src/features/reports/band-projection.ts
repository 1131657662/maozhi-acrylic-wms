import type { ReportAgingRow } from '@wms/contracts';
import type { Projection } from './types.ts';
import { totalBalance } from './totals.ts';

export function bandProjection(projection: Projection, rows: ReportAgingRow[]): Projection {
  const keys = new Set(rows.map((r) => JSON.stringify([r.warehouseCode, r.productCode])));
  const cells = new Map([...projection.cells].filter(([key]) => keys.has(key)));
  return {
    ...projection,
    cells,
    metadata: {
      ...projection.metadata,
      reconciliation: totalBalance([...cells.values()]),
      totalCells: cells.size,
      unverifiedCells: [...cells.values()].filter((c) => c.periods.get('range')!.checkState === '不可验证').length,
    },
  };
}
