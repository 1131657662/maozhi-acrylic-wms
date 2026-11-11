import { randomUUID } from 'node:crypto';
import { type ActualQuantity, type Detail } from '@wms/contracts';
import type { Database } from '../../db/mysql.ts';
import type { Actor } from '../../shared/audit.ts';
import { AppError } from '../../shared/errors.ts';

export function validateActuals(order: Detail, lines: ActualQuantity[]) {
  const ids = new Set(lines.map((line) => line.lineId));
  if (ids.size !== lines.length || lines.length !== order.lines.length || order.lines.some((line) => !ids.has(line.id)))
    throw new AppError('ACTUAL_LINES_INVALID', '请填写每一行的实发数量，不可重复或使用其他单据的明细', 422);
  if (lines.every((line) => line.actualPackages === 0 && line.actualWeightGrams === 0))
    throw new AppError('ACTUAL_EMPTY', '本次没有发货数量', 422);
}
export async function createShipment(
  db: Database,
  order: Detail,
  lines: ActualQuantity[],
  operationId: string,
  actor: Actor,
) {
  const id = randomUUID();
  await db.run(
    `INSERT INTO outbound_shipments(id,order_id,seq,vehicle_no,shipped_at,business_date,operator,operation_id)
    VALUES(?,?,1,?,UTC_TIMESTAMP(3),COALESCE(?,DATE(UTC_TIMESTAMP()+INTERVAL 8 HOUR)),?,?)`,
    [id, order.id, order.vehicleNo, order.businessDate, actor.username, operationId],
  );
  for (const line of lines) {
    await db.run(
      `INSERT INTO outbound_shipment_lines(shipment_id,order_line_id,packages,weight_grams,overage_reason)
      VALUES(?,?,?,?,?)`,
      [id, line.lineId, line.actualPackages, line.actualWeightGrams, line.overageReason ?? null],
    );
    const scan = order.lines.find((item) => item.id === line.lineId)!;
    await db.run('UPDATE outbound_lines SET scan_packages=?,scan_weight_grams=? WHERE id=?', [
      scan.scanPackages ?? 0,
      scan.scanWeightGrams ?? 0,
      line.lineId,
    ]);
  }
  return id;
}
export function shipmentStockChanges(order: Detail, lines: ActualQuantity[]) {
  const totals = new Map<string, { productCode: string; packagesDelta: number; weightDeltaGrams: number }>();
  for (const line of lines) {
    const productCode = order.lines.find((item) => item.id === line.lineId)!.productCode;
    const total = totals.get(productCode) ?? { productCode, packagesDelta: 0, weightDeltaGrams: 0 };
    total.packagesDelta -= line.actualPackages;
    total.weightDeltaGrams -= line.actualWeightGrams;
    totals.set(productCode, total);
  }
  return [...totals.values()];
}
