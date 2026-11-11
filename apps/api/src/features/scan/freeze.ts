import type { Database } from '../../db/mysql.ts';
import type { Detail } from '@wms/contracts';
import { getOrder } from '../outbound/repository.ts';
import { ensure } from '../../shared/errors.ts';
import { audit } from '../../shared/audit.ts';
import { sqlDate } from '../../db/dates.ts';
import { replay, saveResult, checkRevision, lockPlan, type PlanCommand } from '../../shared/command.ts';

export async function freezePlan(db: Database, command: PlanCommand): Promise<Detail> {
  return db.transaction(async (tx) => {
    await lockPlan(tx, command.planId);
    const previous = await replay(tx, 'freeze', command);
    if (previous) return previous;
    const before = await getOrder(tx, command.planId);
    checkRevision(before, command.expected);
    ensure(before.status === 'open', 'PLAN_CLOSED', '此计划不能再次冻结');
    ensure(
      before.lines.every(
        (line) => line.scanPackages === line.plannedPackages && line.scanWeightGrams === line.plannedWeightGrams,
      ),
      'PLAN_DIFFERENCE',
      '包数或实重与计划不一致，本阶段禁止带差异冻结',
    );
    await tx.run('INSERT INTO scan_submissions(plan_id,digest,revision,created_at) VALUES(?,?,?,?)', [
      before.id,
      before.digest,
      before.revision,
      sqlDate(new Date().toISOString()),
    ]);
    await tx.run("UPDATE outbound_orders SET status='frozen',revision=revision+1 WHERE id=?", [before.id]);
    const after = await getOrder(tx, before.id);
    await audit(tx, command.actor, { action: 'scan.freeze', targetId: before.id, before, after });
    await saveResult(tx, { scope: 'freeze', command }, after);
    return after;
  });
}
