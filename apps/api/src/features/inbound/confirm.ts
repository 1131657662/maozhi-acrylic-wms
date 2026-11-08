import { inboundReceiptSchema } from '@wms/contracts';
import type { Database } from '../../db/mysql.ts';
import { audit, type Actor } from '../../shared/audit.ts';
import { ensure } from '../../shared/errors.ts';
import { replayCommand, saveCommand } from '../../shared/idempotency.ts';
import { createOperation, lockInventoryWriter } from '../inventory/operation.ts';
import { postInventory } from '../inventory/posting.ts';
import { getInbound } from './repository.ts';

export async function confirmInbound(db: Database, id: string, key: string, actor: Actor) {
  return db.transaction(async (tx) => {
    await lockInventoryWriter(tx);
    const replay = await replayCommand(tx, 'inbound.confirm', key, { id }, actor, inboundReceiptSchema);
    if (replay) return replay;
    const row = await tx.get('SELECT source_id FROM inbound_receipts WHERE id=? FOR UPDATE', [id]);
    const before = await getInbound(tx, id);
    ensure(
      row?.source_id === null && before.postingState !== 'legacy',
      'LEGACY_RECEIPT',
      '历史入库单只读，不能再次入账',
    );
    ensure(
      before.postingState === 'pending' && before.status === 'pending',
      'ALREADY_CONFIRMED',
      '此入库单已确认或不处于待确认状态',
    );
    const operation = await createOperation(tx, 'inbound.confirm', id, '明确确认入库', actor);
    const changes = before.lines.map((line) => ({
      productCode: line.productCode,
      packagesDelta: line.packages,
      weightDeltaGrams: line.weightGrams,
    }));
    await postInventory(tx, operation, before.warehouseCode, changes);
    await tx.run(
      "UPDATE inbound_receipts SET status='confirmed',posting_state='confirmed',confirmation_operation_id=? WHERE id=?",
      [operation.id, id],
    );
    const after = await getInbound(tx, id);
    await audit(tx, actor, { action: operation.type, targetId: id, before, after });
    await saveCommand(tx, 'inbound.confirm', key, { id }, actor, after);
    return after;
  });
}
