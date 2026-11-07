import { randomUUID } from 'node:crypto';
import { createOutboundPlanSchema, detailSchema, editOutboundPlanSchema, type OutboundPlanFields } from '@wms/contracts';
import type { Database } from '../../db/mysql.ts';
import { gramsToDecimal } from '../../db/weight.ts';
import { sqlDate } from '../../db/dates.ts';
import { audit, type Actor } from '../../shared/audit.ts';
import { AppError, ensure } from '../../shared/errors.ts';
import { checkRevision, lockPlan } from '../../shared/command.ts';
import { replayCommand, saveCommand } from '../../shared/idempotency.ts';
import { activeMaster } from '../master-data/catalogs.ts';
import { getOrder } from './repository.ts';

export async function createOutboundPlan(db: Database, input: OutboundPlanFields, key: string, actor: Actor) {
  const plan = createOutboundPlanSchema.parse(input);
  return db.transaction(async (tx) => {
    await lockNewCommand(tx);
    const replay = await replayCommand(tx, 'outbound.create', key, plan, actor, detailSchema);
    if (replay) return replay;
    const references = await validateReferences(tx, plan);
    const id = randomUUID();
    const createdAt = sqlDate(new Date().toISOString());
    try {
      await tx.run(`INSERT INTO outbound_orders(id,order_no,customer_name,customer_code,warehouse_code,vehicle_no,created_at)
        VALUES(?,?,?,?,?,?,?)`, [id,plan.orderNo,references.customer.name,references.customer.code,
        references.warehouse.code,plan.vehicleNo,createdAt]);
    } catch (error) { if (duplicate(error)) throw duplicateOrder(); throw error; }
    await insertLines(tx, id, plan, references.products);
    const after = await getOrder(tx, id);
    await audit(tx, actor, { action: 'outbound.plan.create', targetId: id, before: null, after });
    await saveCommand(tx, 'outbound.create', key, plan, actor, after);
    return after;
  });
}
export async function editOutboundPlan(db: Database, id: string, input: unknown, key: string, actor: Actor) {
  const command = editOutboundPlanSchema.parse(input);
  return db.transaction(async (tx) => {
    await lockPlan(tx, id);
    const replay = await replayCommand(tx, 'outbound.edit', key, [id,command], actor, detailSchema);
    if (replay) return replay;
    const before = await getOrder(tx, id);
    checkRevision(before, command);
    ensure(before.status === 'open' && before.facts.length === 0, 'PLAN_NOT_EDITABLE', '待扫码且没有扫码事实时才可修改计划');
    const references = await validateReferences(tx, command.plan);
    await tx.run(`UPDATE outbound_orders SET order_no=?,customer_name=?,customer_code=?,warehouse_code=?,vehicle_no=?,revision=revision+1
      WHERE id=?`, [command.plan.orderNo,references.customer.name,references.customer.code,
      references.warehouse.code,command.plan.vehicleNo,id]);
    await tx.run('DELETE FROM outbound_lines WHERE order_id=?', [id]);
    await insertLines(tx, id, command.plan, references.products);
    const after = await getOrder(tx, id);
    await audit(tx, actor, { action: 'outbound.plan.update', targetId: id, before, after });
    await saveCommand(tx, 'outbound.edit', key, [id,command], actor, after);
    return after;
  });
}
async function validateReferences(db: Database, plan: OutboundPlanFields) {
  const customer = await activeMaster(db, 'customers', plan.customerCode);
  const warehouse = await activeMaster(db, 'warehouses', plan.warehouseCode);
  const products = await Promise.all(plan.lines.map((line) => activeMaster(db, 'products', line.productCode)));
  return { customer, warehouse, products };
}
async function insertLines(db: Database, id: string, plan: OutboundPlanFields,
  products: { code: string; name: string; active: true }[]): Promise<void> {
  for (const [index, line] of plan.lines.entries()) await db.run(`INSERT INTO outbound_lines
    (id,order_id,product_code,product_name,planned_packages,planned_weight_tonnes) VALUES(?,?,?,?,?,?)`,
    [randomUUID(),id,products[index]!.code,products[index]!.name,line.plannedPackages,gramsToDecimal(line.plannedWeightGrams)]);
}
async function lockNewCommand(db: Database): Promise<void> {
  await db.get("SELECT value FROM app_meta WHERE meta_key='identity' FOR UPDATE");
}
function duplicate(error: unknown): boolean {
  return typeof error === 'object' && error !== null && 'code' in error && error.code === 'ER_DUP_ENTRY';
}
function duplicateOrder() {
  return new AppError('DUPLICATE_ORDER_NO', '出库单号已存在');
}
