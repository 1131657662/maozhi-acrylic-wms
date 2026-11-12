import { detailSchema, shortCloseSchema } from '@wms/contracts';
import type { Database } from '../../db/mysql.ts';
import { audit } from '../../shared/audit.ts';
import { lockPlan, checkRevision } from '../../shared/command.ts';
import { replayCommand, saveCommand } from '../../shared/idempotency.ts';
import { ensure } from '../../shared/errors.ts';
import { getOrder } from '../outbound/repository.ts';
import { assertShipmentOrder, remainingTotal } from './policy.ts';
import type { ShipmentCommand } from './create.ts';

export async function shortCloseShipment(db: Database, command: ShipmentCommand) {
  const input = shortCloseSchema.parse(command.input),
    payload = { id: command.id, input };
  return db.transaction(async (tx) => {
    await lockPlan(tx, command.id);
    const previous = await replayCommand(tx, 'outbound.short-close', command.key, payload, command.actor, detailSchema);
    if (previous) return previous;
    const before = await getOrder(tx, command.id);
    await assertShipmentOrder(tx, before);
    checkRevision(before, input);
    ensure(before.status === 'partially_shipped', 'NO_SHIPMENT', '尚未发货，不能短关，请使用作废');
    const remaining = remainingTotal(before);
    await tx.run(
      `UPDATE outbound_orders SET status='short_closed',short_closed_at=UTC_TIMESTAMP(3),
      short_close_reason=?,short_closed_packages=?,short_closed_grams=?,revision=revision+1 WHERE id=?`,
      [input.reason, remaining.packages, remaining.weightGrams, before.id],
    );
    const after = await getOrder(tx, before.id);
    await audit(tx, command.actor, {
      action: 'outbound.short-close',
      targetId: before.id,
      before,
      after: {
        ...after,
        shortCloseReason: input.reason,
        shortClosedPackages: remaining.packages,
        shortClosedWeightGrams: remaining.weightGrams,
      },
    });
    await saveCommand(tx, 'outbound.short-close', command.key, payload, command.actor, after);
    return after;
  });
}
