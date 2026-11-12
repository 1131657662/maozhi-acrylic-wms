import type { Detail, ShipmentPlan } from '@wms/contracts';
import type { Database } from '../../db/mysql.ts';
import { gramsToDecimal } from '../../db/weight.ts';
import { AppError } from '../../shared/errors.ts';

type PlanLines = NonNullable<ShipmentPlan['plan']['lines']>;
function validateShippedMinimum(order: Detail, lines: PlanLines) {
  const issues = lines.flatMap((line, index) => {
    const shipped = order.lines.find((item) => item.id === line.id)!;
    return [
      { key: 'plannedPackages', planned: line.plannedPackages, actual: shipped.actualPackages, label: '计划包数' },
      {
        key: 'plannedWeightGrams',
        planned: line.plannedWeightGrams,
        actual: shipped.actualWeightGrams,
        label: '计划重量',
      },
    ]
      .filter((value) => value.planned < value.actual)
      .map((value) => ({
        lineId: line.id,
        productCode: shipped.productCode,
        productName: shipped.productName,
        path: `plan.lines.${index}.${value.key}`,
        planned: value.planned,
        shipped: value.actual,
        message: `第 ${index + 1} 行${value.label}不能小于已发数量`,
      }));
  });
  if (issues.length)
    throw new AppError('PLAN_BELOW_SHIPPED', '计划数量不能小于已发数量，请核对明细', 422, {
      lines: issues,
      fields: issues.map(({ path, message }) => ({ path, message })),
    });
}

export async function updatePlanLines(db: Database, order: Detail, lines: NonNullable<ShipmentPlan['plan']['lines']>) {
  const ids = lines.map((line) => line.id);
  if (new Set(ids).size !== ids.length || ids.some((id) => !order.lines.some((line) => line.id === id)))
    throw new AppError('PLAN_LINES_INVALID', '明细重复或不属于本单', 422);
  validateShippedMinimum(order, lines);
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
