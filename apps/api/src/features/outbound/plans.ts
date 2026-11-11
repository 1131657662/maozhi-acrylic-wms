import { randomUUID } from 'node:crypto';
import {
  createOutboundPlanSchema,
  detailSchema,
  editOutboundPlanSchema,
  type OutboundPlanFields,
} from '@wms/contracts';
import type { Database } from '../../db/mysql.ts';
import { gramsToDecimal } from '../../db/weight.ts';
import { sqlDate } from '../../db/dates.ts';
import { audit, type Actor } from '../../shared/audit.ts';
import { AppError } from '../../shared/errors.ts';
import { checkRevision, lockPlan } from '../../shared/command.ts';
import { replayCommand, saveCommand } from '../../shared/idempotency.ts';
import { activeMaster } from '../master-data/catalogs.ts';
import { getOrder } from './repository.ts';
import { allocateNumber } from '../document-numbering/service.ts';
import { lockInventoryWriter } from '../inventory/operation.ts';
import { requireInventoryProduct } from '../inventory/posting.ts';
import { assertEditableHeader } from './edit-policy.ts';
import { validateBusinessDate } from '../business-date/policy.ts';
import { captureOutboundSnapshots, captureVehicle } from './snapshots.ts';

export async function createOutboundPlan(db: Database, input: OutboundPlanFields, key: string, actor: Actor) {
  const plan = createOutboundPlanSchema.parse(input);
  return db.transaction(async (tx) => {
    await lockNewCommand(tx);
    const replay = await replayCommand(tx, 'outbound.create', key, plan, actor, detailSchema);
    if (replay) return replay;
    const date = validateBusinessDate(plan);
    const references = await validateReferences(tx, plan);
    const id = randomUUID();
    const createdAt = sqlDate(new Date().toISOString());
    const orderNo = await allocateNumber(tx, 'outbound', plan.orderNo, date.businessDate.replaceAll('-', ''));
    try {
      await tx.run(
        `INSERT INTO outbound_orders(id,order_no,customer_name,customer_code,warehouse_code,vehicle_no,memo,bill_type,container_no,created_at,business_date)
        VALUES(?,?,?,?,?,?,?,?,?,?,?)`,
        [
          id,
          orderNo,
          references.customer.name,
          references.customer.code,
          references.warehouse.code,
          plan.vehicleNo,
          plan.memo ?? null,
          plan.billType,
          plan.containerNo || null,
          createdAt,
          date.businessDate,
        ],
      );
    } catch (error) {
      if (duplicate(error)) throw duplicateOrder();
      throw error;
    }
    await insertLines(tx, id, plan, references.products);
    await captureOutboundSnapshots(tx, { id, plan }, actor);
    const after = await getOrder(tx, id);
    await audit(tx, actor, {
      action: 'outbound.plan.create',
      targetId: id,
      before: null,
      after: { ...after, businessDateConfirmation: date },
    });
    await saveCommand(tx, 'outbound.create', key, plan, actor, after);
    return after;
  });
}
export async function editOutboundPlan(db: Database, id: string, input: unknown, key: string, actor: Actor) {
  const command = editOutboundPlanSchema.parse(input);
  return db.transaction(async (tx) => {
    // Serialize plan moves/edits with stocktake preview verification.
    await lockInventoryWriter(tx);
    await lockPlan(tx, id);
    const replay = await replayCommand(tx, 'outbound.edit', key, [id, command], actor, detailSchema);
    if (replay) return replay;
    const before = await getOrder(tx, id);
    await assertEditableHeader(tx, before, command.plan);
    checkRevision(before, command);
    if (command.plan.vehicleNo !== before.vehicleNo)
      await captureVehicle(tx, { id, plate: command.plan.vehicleNo }, actor);
    await tx.run(
      'UPDATE outbound_orders SET vehicle_no=?,memo=?,bill_type=?,container_no=?,revision=revision+1 WHERE id=?',
      [
        command.plan.vehicleNo,
        command.plan.memo === undefined ? before.memo : command.plan.memo,
        command.plan.billType === undefined ? before.billType : command.plan.billType,
        command.plan.containerNo === undefined ? before.containerNo : command.plan.containerNo || null,
        id,
      ],
    );
    for (const [index, line] of (command.plan.lines ?? []).entries()) {
      const previous =
        'id' in line ? before.lines.find((candidate) => candidate.id === line.id)! : before.lines[index]!;
      await tx.run('UPDATE outbound_lines SET contract_no=?,memo=? WHERE id=? AND order_id=?', [
        line.contractNo === undefined ? previous.contractNo : line.contractNo || null,
        line.memo === undefined ? previous.memo : line.memo || null,
        previous.id,
        id,
      ]);
    }
    const after = await getOrder(tx, id);
    await audit(tx, actor, { action: 'outbound.plan.update', targetId: id, before, after });
    await saveCommand(tx, 'outbound.edit', key, [id, command], actor, after);
    return after;
  });
}
async function validateReferences(db: Database, plan: OutboundPlanFields) {
  const customer = await activeMaster(db, 'customers', plan.customerCode);
  const warehouse = await activeMaster(db, 'warehouses', plan.warehouseCode);
  const products = await Promise.all(plan.lines.map((line) => activeMaster(db, 'products', line.productCode)));
  for (const product of products) await requireInventoryProduct(db, product.code);
  return { customer, warehouse, products };
}
async function insertLines(
  db: Database,
  id: string,
  plan: OutboundPlanFields,
  products: { code: string; name: string; active: true }[],
): Promise<void> {
  for (const [index, line] of plan.lines.entries())
    await db.run(
      `INSERT INTO outbound_lines
    (id,order_id,product_code,product_name,planned_packages,planned_weight_tonnes,line_position,contract_no,memo) VALUES(?,?,?,?,?,?,?,?,?)`,
      [
        randomUUID(),
        id,
        products[index]!.code,
        products[index]!.name,
        line.plannedPackages,
        gramsToDecimal(line.plannedWeightGrams),
        index + 1,
        line.contractNo || null,
        line.memo || null,
      ],
    );
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
