import { z } from 'zod';
import type { Database } from '../../db/mysql.ts';
import { audit, type Actor } from '../../shared/audit.ts';
import { lockPlan } from '../../shared/command.ts';
import { AppError } from '../../shared/errors.ts';
import { saveCommand, replayCommand } from '../../shared/idempotency.ts';
import { writableOrder } from './record.ts';

const resultSchema = z.object({ recordId: z.string(), revoked: z.literal(true) });
export async function revokeScanRecord(db: Database, id: string, recordId: string, key: string, actor: Actor) {
  return db.transaction(async (tx) => {
    await lockPlan(tx, id);
    const input = { id, recordId };
    const previous = await replayCommand(tx, 'web.scan.revoke', key, input, actor, resultSchema);
    if (previous) return previous;
    const order = await writableOrder(tx, id, false);
    const fact = order.facts.find((f) => f.id === recordId);
    if (!fact) throw new AppError('NOT_FOUND', '记录不存在或已撤销', 404);
    await tx.run('UPDATE scan_facts SET revoked_at=UTC_TIMESTAMP(3),revoked_by=? WHERE id=?', [
      actor.username,
      recordId,
    ]);
    await tx.run('UPDATE outbound_orders SET revision=revision+1 WHERE id=?', [id]);
    await audit(tx, actor, {
      action: 'scan.revoke',
      targetId: id,
      before: {
        recordId,
        barcode: fact.barcode,
        productCode: fact.productCode,
        attribution: fact.attribution,
        source: fact.source,
      },
      after: { revoked: true, orderNo: order.orderNo },
    });
    const result = { recordId, revoked: true as const };
    await saveCommand(tx, 'web.scan.revoke', key, input, actor, result);
    return result;
  });
}
