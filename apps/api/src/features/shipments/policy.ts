import type { Detail, ActualQuantity } from '@wms/contracts';
import type { Database } from '../../db/mysql.ts';
import { AppError, ensure } from '../../shared/errors.ts';

export async function assertShipmentOrder(db: Database, order: Detail, allowCompleted = false): Promise<void> {
  const row = await db.get('SELECT source_id FROM outbound_orders WHERE id=?', [order.id]);
  ensure(row?.source_id === null, 'LEGACY_ORDER', '历史出库单只读，不能再次扣库存');
  ensure(
    ['open', 'partially_shipped', ...(allowCompleted ? ['confirmed'] : [])].includes(order.status),
    'PLAN_CLOSED',
    '单据已结单，不能继续发货或修改计划',
  );
}
export function remainingLines(order: Detail) {
  return order.lines.map((line) => ({
    lineId: line.id,
    productCode: line.productCode,
    productName: line.productName,
    packages: Math.max(
      0,
      line.plannedPackages -
        (order.corrections?.lines.find((l) => l.originalLineId === line.id)?.effective.packages ?? line.actualPackages),
    ),
    weightGrams: Math.max(
      0,
      line.plannedWeightGrams -
        (order.corrections?.lines.find((l) => l.originalLineId === line.id)?.effective.weightGrams ??
          line.actualWeightGrams),
    ),
  }));
}
export function remainingTotal(order: Detail) {
  return remainingLines(order).reduce(
    (sum, line) => ({ packages: sum.packages + line.packages, weightGrams: sum.weightGrams + line.weightGrams }),
    { packages: 0, weightGrams: 0 },
  );
}
export function validateOverages(order: Detail, lines: ActualQuantity[]): void {
  const remaining = remainingLines(order);
  const missing = lines.flatMap((line, index) => {
    const pending = remaining.find((item) => item.lineId === line.lineId)!;
    return (line.actualPackages > pending.packages || line.actualWeightGrams > pending.weightGrams) &&
      !line.overageReason?.trim()
      ? [{ lineId: line.lineId, productCode: pending.productCode, productName: pending.productName, index }]
      : [];
  });
  if (missing.length)
    throw new AppError('OVERAGE_REASON_REQUIRED', '超过待发数量，请填写对应行的溢发原因', 422, {
      lines: missing,
      fields: missing.map((line) => ({ path: ['lines', line.index, 'overageReason'], message: '溢发原因必填' })),
    });
}
