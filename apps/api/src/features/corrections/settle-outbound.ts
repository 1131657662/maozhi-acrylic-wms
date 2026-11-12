import type { Database } from '../../db/mysql.ts';
import { audit, type Actor } from '../../shared/audit.ts';
import { getOrder } from '../outbound/repository.ts';
import { remainingTotal } from '../shipments/policy.ts';

export async function settleCorrectedOutbound(
  db: Database,
  id: string,
  context: {
    before: { status: string; shortClosedPackages: number | null; shortClosedWeightGrams: number | null };
    actor: Actor;
  },
) {
  const order = await getOrder(db, id),
    remaining = remainingTotal(order);
  const status =
    context.before.status === 'short_closed'
      ? 'short_closed'
      : remaining.packages || remaining.weightGrams
        ? 'partially_shipped'
        : 'confirmed';
  if (status === 'short_closed')
    await db.run('UPDATE outbound_orders SET short_closed_packages=?,short_closed_grams=? WHERE id=?', [
      remaining.packages,
      remaining.weightGrams,
      id,
    ]);
  else await db.run('UPDATE outbound_orders SET status=? WHERE id=?', [status, id]);
  const after = {
    ...context.before,
    status,
    orderNo: order.orderNo,
    reason: '更正',
    ...(status === 'short_closed'
      ? { shortClosedPackages: remaining.packages, shortClosedWeightGrams: remaining.weightGrams }
      : {}),
  };
  if (
    status !== context.before.status ||
    after.shortClosedPackages !== context.before.shortClosedPackages ||
    after.shortClosedWeightGrams !== context.before.shortClosedWeightGrams
  )
    await audit(db, context.actor, {
      action: 'outbound.correction',
      targetId: id,
      before: { ...context.before, orderNo: order.orderNo },
      after,
    });
}
