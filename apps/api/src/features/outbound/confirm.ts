import type { Database } from '../../db/mysql.ts';
import {
  actualQuantitySchema,
  OUTBOUND_MAX_LINES,
  detailSchema,
  type ActualQuantity,
  type Detail,
} from '@wms/contracts';
import { z } from 'zod';
import { getOrder } from './repository.ts';
import { ensure } from '../../shared/errors.ts';
import { audit } from '../../shared/audit.ts';
import { checkRevision, lockPlan, type PlanCommand } from '../../shared/command.ts';
import { replayCommand, saveCommand } from '../../shared/idempotency.ts';
import { createOperation, lockInventoryWriter } from '../inventory/operation.ts';
import { postInventory } from '../inventory/posting.ts';
import { createShipment, shipmentStockChanges, validateActuals } from './shipments.ts';

export async function confirmOutbound(
  db: Database,
  command: PlanCommand & { lines: ActualQuantity[] },
): Promise<Detail> {
  const lines = z.array(actualQuantitySchema).min(1).max(OUTBOUND_MAX_LINES).parse(command.lines);
  const payload = [command.planId, { revision: command.expected.revision, digest: command.expected.digest }, lines];
  return db.transaction(async (tx) => {
    await lockInventoryWriter(tx);
    await lockPlan(tx, command.planId);
    const previous = await replayCommand(tx, 'confirm', command.key, payload, command.actor, detailSchema);
    if (previous) return previous;
    const source = await tx.get('SELECT source_id FROM outbound_orders WHERE id=?', [command.planId]);
    ensure(source?.source_id === null, 'LEGACY_ORDER', '历史出库单只读，不能再次扣库存');
    const before = await getOrder(tx, command.planId);
    checkRevision(before, command.expected);
    ensure(['open', 'frozen'].includes(before.status), 'PLAN_CLOSED', '该单已经确认或终结，不能再次出库');
    validateActuals(before, lines);
    const operation = await createOperation(tx, 'outbound.confirm', before.id, '人工确认实发出库', command.actor);
    const shipmentId = await createShipment(tx, before, lines, operation.id, command.actor);
    await postInventory(tx, operation, before.warehouseCode, shipmentStockChanges(before, lines));
    await tx.run("UPDATE outbound_orders SET status='confirmed',revision=revision+1 WHERE id=?", [before.id]);
    const after = await getOrder(tx, before.id);
    await audit(tx, command.actor, {
      action: operation.type,
      targetId: before.id,
      before,
      after: { ...after, operationId: operation.id, shipmentId },
    });
    await saveCommand(tx, 'confirm', command.key, payload, command.actor, after);
    return after;
  });
}
