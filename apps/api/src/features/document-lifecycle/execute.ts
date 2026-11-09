import { randomUUID } from 'node:crypto';
import {
  lifecyclePreviewSchema,
  type LifecycleAction,
  type LifecycleCommand,
  type LifecyclePreview,
} from '@wms/contracts';
import type { Database } from '../../db/mysql.ts';
import { audit, type Actor } from '../../shared/audit.ts';
import { ensure } from '../../shared/errors.ts';
import { replayCommand, saveCommand } from '../../shared/idempotency.ts';
import { createOperation, lockInventoryWriter } from '../inventory/operation.ts';
import { postInventory } from '../inventory/posting.ts';
import { documentTables, lockDocument, type DocumentTarget } from './document.ts';
import { lifecyclePreview } from './preview.ts';

interface CloseCommand extends DocumentTarget {
  action: LifecycleAction;
  input: LifecycleCommand;
  key: string;
  actor: Actor;
}
async function compensate(db: Database, command: CloseCommand, before: LifecyclePreview) {
  if (command.action === 'void') return null;
  const operation = await createOperation(
    db,
    `${command.kind}.reverse`,
    command.id,
    command.input.reason,
    command.actor,
  );
  await postInventory(
    db,
    operation,
    before.lines[0]!.warehouseCode,
    before.lines.map((line) => ({
      productCode: line.productCode,
      packagesDelta: line.packagesDelta,
      weightDeltaGrams: line.weightDeltaGrams,
      expected: { packages: line.packagesBefore, weightGrams: line.weightBeforeGrams },
    })),
  );
  return operation.id;
}
async function closeDocument(db: Database, command: CloseCommand, before: LifecyclePreview) {
  const compensationId = await compensate(db, command, before);
  if (compensationId)
    await db.run(
      `UPDATE document_corrections SET offset_operation_id=? WHERE ${documentTables[command.kind].reference}=?`,
      [compensationId, command.id],
    );
  const status = command.action === 'reverse' ? 'cancelled' : 'voided';
  if (command.kind === 'inbound')
    await db.run('UPDATE inbound_receipts SET status=?,posting_state=? WHERE id=?', [
      status,
      command.action === 'reverse' ? 'reversed' : 'voided',
      command.id,
    ]);
  else await db.run('UPDATE outbound_orders SET status=?,revision=revision+1 WHERE id=?', [status, command.id]);
  await db.run(
    `INSERT INTO document_closures(id,${documentTables[command.kind].reference},action,reason,
    original_operation_id,compensation_operation_id,actor,created_at) VALUES(?,?,?,?,?,?,?,UTC_TIMESTAMP(3))`,
    [
      randomUUID(),
      command.id,
      command.action,
      command.input.reason,
      before.originalOperationId,
      compensationId,
      command.actor.username,
    ],
  );
}
export async function executeLifecycle(db: Database, command: CloseCommand): Promise<LifecyclePreview> {
  return db.transaction(async (tx) => {
    await lockInventoryWriter(tx);
    await lockDocument(tx, command);
    const scope = `${command.kind}.${command.action}`,
      payload = { id: command.id, ...command.input };
    const replay = await replayCommand(tx, scope, command.key, payload, command.actor, lifecyclePreviewSchema);
    if (replay) return replay;
    const before = await lifecyclePreview(tx, command);
    ensure(
      before.action === command.action,
      'INVALID_TRANSITION',
      '已入账单据只能撤销；作废仅限未入账单据，终态不能重开',
    );
    ensure(
      before.allowed,
      before.blockers[0]?.code ?? 'LIFECYCLE_BLOCKED',
      before.blockers[0]?.message ?? '单据不能执行此操作',
    );
    ensure(
      before.token === command.input.expectedToken,
      'STALE_LIFECYCLE',
      '单据或库存已变化；原因已保留，请刷新预览并重新核对',
    );
    await closeDocument(tx, command, before);
    const after = await lifecyclePreview(tx, command);
    await audit(tx, command.actor, { action: scope, targetId: command.id, before, after });
    await saveCommand(tx, scope, command.key, payload, command.actor, after);
    return after;
  });
}
