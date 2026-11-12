import { completeShipmentSchema, detailSchema } from '@wms/contracts';
import type { Database } from '../../db/mysql.ts';
import { audit } from '../../shared/audit.ts';
import { lockPlan, checkRevision } from '../../shared/command.ts';
import { replayCommand, saveCommand } from '../../shared/idempotency.ts';
import { AppError, ensure } from '../../shared/errors.ts';
import { getOrder } from '../outbound/repository.ts';
import { assertShipmentOrder, remainingLines } from './policy.ts';
import type { ShipmentCommand } from './create.ts';

export async function completeShipment(db: Database, command: ShipmentCommand) {
  const input = completeShipmentSchema.parse(command.input),
    payload = { id: command.id, input };
  return db.transaction(async (tx) => {
    await lockPlan(tx, command.id);
    const previous = await replayCommand(tx, 'outbound.complete', command.key, payload, command.actor, detailSchema);
    if (previous) return previous;
    const before = await getOrder(tx, command.id);
    await assertShipmentOrder(tx, before, true);
    checkRevision(before, input);
    const remaining = remainingLines(before).filter((line) => line.packages > 0 || line.weightGrams > 0);
    if (remaining.length)
      throw new AppError('SHIPMENT_REMAINING', '仍有待发数量，请继续发货或填写原因短关', 422, { lines: remaining });
    if (before.status === 'confirmed') {
      await saveCommand(tx, 'outbound.complete', command.key, payload, command.actor, before);
      return before;
    }
    ensure(before.status === 'partially_shipped', 'NO_SHIPMENT', '尚未发货，不能完成发货');
    await tx.run("UPDATE outbound_orders SET status='confirmed',revision=revision+1 WHERE id=?", [before.id]);
    const after = await getOrder(tx, before.id);
    await audit(tx, command.actor, {
      action: 'outbound.complete',
      targetId: before.id,
      before,
      after: { ...after, completedAt: new Date().toISOString() },
    });
    await saveCommand(tx, 'outbound.complete', command.key, payload, command.actor, after);
    return after;
  });
}
