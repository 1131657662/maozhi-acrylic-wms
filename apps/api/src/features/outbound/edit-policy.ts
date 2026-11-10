import type { Detail, EditOutboundPlan } from '@wms/contracts';
import type { Database } from '../../db/mysql.ts';
import { ensure, AppError } from '../../shared/errors.ts';

export async function assertEditableHeader(
  db: Database,
  before: Detail,
  plan: EditOutboundPlan['plan'],
): Promise<void> {
  ensure(
    plan.orderNo === undefined || plan.orderNo === before.orderNo,
    'DOCUMENT_NUMBER_IMMUTABLE',
    '单号创建后不可修改；旧客户端可原样回传单号',
  );
  const header = await db.get('SELECT source_id FROM outbound_orders WHERE id=?', [before.id]);
  ensure(
    header?.source_id == null && before.status === 'open',
    'PLAN_NOT_EDITABLE',
    '仅本地待扫码计划可修改车号/备注；历史单据、冻结或终态计划不可编辑',
  );
  if (plan.lines && !sameLines(before, plan.lines)) {
    const exposure = await db.get('SELECT plan_id FROM outbound_plan_exposures WHERE plan_id=?', [before.id]);
    const message =
      exposure || before.facts.length
        ? '计划已下发或已有扫码事实，明细不可修改，只能改车号/备注；如需改明细请作废后重建。作废仍须满足原有条件，已下发或已有事实的计划当前不能直接作废。'
        : '计划创建后明细不可修改，只能改车号/备注；如需改明细请作废后重建';
    throw new AppError('PLAN_LINES_IMMUTABLE', message);
  }
  ensure(
    (plan.customerCode === undefined || plan.customerCode === before.customerCode) &&
      (plan.contactId === undefined || plan.contactId === before.contactId) &&
      (plan.warehouseCode === undefined || plan.warehouseCode === before.warehouseCode),
    'PLAN_FIELDS_IMMUTABLE',
    '计划创建后客户和仓库不可修改，只能改车号/备注',
  );
}

function sameLines(before: Detail, lines: NonNullable<EditOutboundPlan['plan']['lines']>): boolean {
  if (lines.length !== before.lines.length) return false;
  if (new Set(lines.map((line) => line.productCode)).size !== lines.length) return false;
  return lines.every((line) =>
    before.lines.some(
      (old) =>
        old.productCode === line.productCode &&
        old.plannedPackages === line.plannedPackages &&
        old.plannedWeightGrams === line.plannedWeightGrams,
    ),
  );
}
