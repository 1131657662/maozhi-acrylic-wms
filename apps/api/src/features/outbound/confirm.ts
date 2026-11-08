import type { Database } from '../../db/mysql.ts';
import type { Detail } from '@wms/contracts';
import { getOrder } from './repository.ts';
import { ensure } from '../../shared/errors.ts';
import { audit } from '../../shared/audit.ts';
import { replay, saveResult, checkRevision, lockPlan, type PlanCommand } from '../../shared/command.ts';
import { createOperation, lockInventoryWriter } from '../inventory/operation.ts';
import { postInventory } from '../inventory/posting.ts';

export async function confirmOutbound(db: Database, command: PlanCommand): Promise<Detail> {
  return db.transaction(async (tx) => {
    await lockInventoryWriter(tx);
    await lockPlan(tx, command.planId);
    const previous = await replay(tx, 'confirm', command);
    if (previous) return previous;
    const source = await tx.get('SELECT source_id FROM outbound_orders WHERE id=?', [command.planId]);
    ensure(source?.source_id === null, 'LEGACY_ORDER', '历史出库单只读，不能再次扣库存');
    const before = await getOrder(tx, command.planId);
    checkRevision(before, command.expected);
    ensure(before.status === 'frozen', 'NOT_FROZEN', '只能确认已冻结的扫码计划');
    const submission = await tx.get('SELECT digest FROM scan_submissions WHERE plan_id=?', [before.id]);
    ensure(submission?.digest === before.digest, 'DIGEST_MISMATCH', '冻结摘要与当前事实不一致');
    const operation = await createOperation(tx, 'outbound.confirm', before.id, '明确确认出库', command.actor);
    await postInventory(
      tx,
      operation,
      before.warehouseCode,
      before.lines.map((line) => ({
        productCode: line.productCode,
        packagesDelta: -line.actualPackages,
        weightDeltaGrams: -line.actualWeightGrams,
      })),
    );
    await tx.run("UPDATE outbound_orders SET status='confirmed',revision=revision+1 WHERE id=?", [before.id]);
    const after = await getOrder(tx, before.id);
    await audit(tx, command.actor, {
      action: operation.type,
      targetId: before.id,
      before,
      after: { ...after, operationId: operation.id },
    });
    await saveResult(tx, { scope: 'confirm', command }, after);
    return after;
  });
}
