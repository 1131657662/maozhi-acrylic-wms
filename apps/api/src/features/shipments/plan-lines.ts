import type { Detail, ShipmentPlan } from '@wms/contracts';
import type { Database } from '../../db/mysql.ts';
import { gramsToDecimal } from '../../db/weight.ts';
import { AppError } from '../../shared/errors.ts';

export async function updatePlanLines(db: Database, order: Detail, lines: NonNullable<ShipmentPlan['plan']['lines']>) {
  const ids = lines.map((line) => line.id);
  if (new Set(ids).size !== ids.length || ids.some((id) => !order.lines.some((line) => line.id === id)))
    throw new AppError('PLAN_LINES_INVALID', '明细重复或不属于本单', 422);
  // PATCH supplied existing lines; omitted lines and all shipment snapshots remain unchanged.
  for (const line of lines) {
    const old = order.lines.find((item) => item.id === line.id)!;
    await db.run(
      `UPDATE outbound_lines SET planned_packages=?,planned_weight_tonnes=?,contract_no=?,memo=? WHERE id=? AND order_id=?`,
      [
        line.plannedPackages,
        gramsToDecimal(line.plannedWeightGrams),
        line.contractNo === undefined ? old.contractNo : line.contractNo,
        line.memo === undefined ? old.memo : line.memo,
        line.id,
        order.id,
      ],
    );
  }
}
