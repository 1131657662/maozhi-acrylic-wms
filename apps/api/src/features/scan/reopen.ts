import type { Database } from '../../db/mysql.ts';
import type { Detail } from '@wms/contracts';
import { getOrder } from '../outbound/repository.ts';
import { ensure } from '../../shared/errors.ts';
import { audit } from '../../shared/audit.ts';
import { replay, saveResult, checkRevision, lockPlan, type PlanCommand } from '../../shared/command.ts';

export async function reopenScan(db: Database, command: PlanCommand): Promise<Detail> {
  return db.transaction(async (tx) => {
    await lockPlan(tx, command.planId);
    const previous = await replay(tx, 'scan.reopen', command);
    if (previous) return previous;
    const before = await getOrder(tx, command.planId);
    checkRevision(before, command.expected);
    ensure(before.status === 'open', 'PLAN_CLOSED', '该单已确认或终结，不能重新扫码');
    ensure(
      !(await tx.get('SELECT id FROM outbound_shipments WHERE order_id=? LIMIT 1', [before.id])),
      'SHIPMENT_EXISTS',
      '该单已有发货记录，不能重新扫码',
    );
    ensure(before.scanClosedAt, 'SCAN_OPEN', '该单尚未结束扫码');
    await tx.run('UPDATE outbound_orders SET scan_closed_at=NULL,revision=revision+1 WHERE id=?', [before.id]);
    const after = await getOrder(tx, before.id);
    await audit(tx, command.actor, { action: 'scan.reopen', targetId: before.id, before, after });
    await saveResult(tx, { scope: 'scan.reopen', command }, after);
    return after;
  });
}
