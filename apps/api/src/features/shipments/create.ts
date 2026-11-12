import { detailSchema, shipmentInputSchema, type ShipmentInput, type Detail } from '@wms/contracts';
import type { Database } from '../../db/mysql.ts';
import type { Actor } from '../../shared/audit.ts';
import { audit } from '../../shared/audit.ts';
import { lockPlan, checkRevision } from '../../shared/command.ts';
import { replayCommand, saveCommand } from '../../shared/idempotency.ts';
import { createOperation, lockInventoryWriter } from '../inventory/operation.ts';
import { postInventory } from '../inventory/posting.ts';
import { createShipment, shipmentStockChanges, validateActuals } from '../outbound/shipments.ts';
import { getOrder } from '../outbound/repository.ts';
import { validateBusinessDate } from '../business-date/policy.ts';
import { assertShipmentOrder, validateOverages, remainingTotal } from './policy.ts';

export interface ShipmentCommand {
  id: string;
  input: unknown;
  key: string;
  actor: Actor;
}
function payloadFor(id: string, input: ShipmentInput) {
  const base: unknown[] = [id, { revision: input.revision, digest: input.digest }, input.lines];
  // Preserve old /confirm keys and make both HTTP aliases replay the same command.
  const { vehicleNo, businessDate, backdateConfirmed } = input;
  if (vehicleNo !== undefined || businessDate !== undefined || backdateConfirmed !== undefined)
    base.push({ vehicleNo, businessDate, backdateConfirmed });
  return base;
}
export async function confirmShipment(db: Database, command: ShipmentCommand) {
  const input = shipmentInputSchema.parse(command.input),
    payload = payloadFor(command.id, input);
  return db.transaction(async (tx) => {
    await lockInventoryWriter(tx);
    await lockPlan(tx, command.id);
    const previous = await replayCommand(tx, 'confirm', command.key, payload, command.actor, detailSchema);
    if (previous) return previous;
    const before = await getOrder(tx, command.id);
    checkRevision(before, input);
    await assertShipmentOrder(tx, before);
    validateActuals(before, input.lines);
    validateOverages(before, input.lines);
    const after = await postShipment(tx, { before, input, actor: command.actor });
    await saveCommand(tx, 'confirm', command.key, payload, command.actor, after);
    return after;
  });
}
async function postShipment(tx: Database, context: { before: Detail; input: ShipmentInput; actor: Actor }) {
  const { before, input, actor } = context;
  const date = validateBusinessDate(input);
  const operation = await createOperation(tx, 'outbound.confirm', before.id, '确认本次发货', actor);
  const shipmentId = await createShipment(
    tx,
    { ...before, vehicleNo: input.vehicleNo ?? before.vehicleNo, businessDate: date.businessDate },
    input.lines,
    operation.id,
    actor,
  );
  await postInventory(tx, operation, before.warehouseCode, shipmentStockChanges(before, input.lines));
  await settleStatus(tx, before.id);
  const after = await getOrder(tx, before.id);
  await audit(tx, actor, {
    action: 'outbound.confirm',
    targetId: before.id,
    before,
    after: { ...after, shipmentId, operationId: operation.id, businessDateConfirmation: date },
  });
  return after;
}
async function settleStatus(db: Database, id: string) {
  const remaining = remainingTotal(await getOrder(db, id));
  const status = remaining.packages === 0 && remaining.weightGrams === 0 ? 'confirmed' : 'partially_shipped';
  await db.run(
    'UPDATE outbound_orders SET status=?,scan_closed_at=COALESCE(scan_closed_at,UTC_TIMESTAMP(3)),revision=revision+1 WHERE id=?',
    [status, id],
  );
}
