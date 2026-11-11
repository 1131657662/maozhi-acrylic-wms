import type { Database } from '../../db/mysql.ts';
import type { Detail } from '@wms/contracts';
import { getOrder } from '../outbound/repository.ts';
import { ensure } from '../../shared/errors.ts';
import { audit } from '../../shared/audit.ts';
import { replay, saveResult, checkRevision, lockPlan, type PlanCommand } from '../../shared/command.ts';

export async function freezePlan(db: Database, command: PlanCommand): Promise<Detail> {
  return db.transaction(async (tx) => {
    await lockPlan(tx, command.planId);
    const previous = await replay(tx, 'freeze', command);
    if (previous) return previous;
    const before = await getOrder(tx, command.planId);
    checkRevision(before, command.expected);
    ensure(before.status === 'open', 'PLAN_CLOSED', '该单已确认或终结，不能结束扫码');
    ensure(!before.scanClosedAt, 'SCAN_CLOSED', '已结束扫码，需要继续时请先重新扫码');
    await tx.run('UPDATE outbound_orders SET scan_closed_at=UTC_TIMESTAMP(3),revision=revision+1 WHERE id=?', [
      before.id,
    ]);
    const after = await getOrder(tx, before.id);
    await audit(tx, command.actor, { action: 'scan.freeze', targetId: before.id, before, after });
    await saveResult(tx, { scope: 'freeze', command }, after);
    return after;
  });
}
