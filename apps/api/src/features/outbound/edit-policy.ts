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
  if (plan.lines && !sameLines(before, plan.lines))
    throw new AppError('PLAN_LINES_IMMUTABLE', '只能修改明细行的合同号和备注，商品与计划数量不可修改');
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
  if (lines.every((line) => 'id' in line)) {
    const ids = new Set(lines.map((line) => ('id' in line ? line.id : '')));
    return ids.size === lines.length && before.lines.every((line) => ids.has(line.id));
  }
  if (lines.some((line) => 'id' in line)) return false;
  return before.lines.every((line, index) => {
    const candidate = lines[index];
    return (
      candidate !== undefined &&
      !('id' in candidate) &&
      candidate.productCode === line.productCode &&
      candidate.plannedPackages === line.plannedPackages &&
      candidate.plannedWeightGrams === line.plannedWeightGrams
    );
  });
}
