import { stocktakePostSchema, stocktakeSchema, type StocktakePreview } from '@wms/contracts';
import type { Database } from '../../db/mysql.ts';
import { audit, type Actor } from '../../shared/audit.ts';
import { ensure } from '../../shared/errors.ts';
import { replayCommand, saveCommand } from '../../shared/idempotency.ts';
import { createOperation, lockInventoryWriter } from '../inventory/operation.ts';
import { postCountedInventory } from '../inventory/stocktake-posting.ts';
import { postDiscoveredInventory } from '../inventory/discovery-posting.ts';
import { lockCounting } from './window.ts';
import { lockUnpostedOrders } from './unposted.ts';
import { stocktakePreview } from './preview.ts';
import { getStocktake } from './read-model.ts';

interface PostCommand {
  id: string;
  input: unknown;
  key: string;
  actor: Actor;
}
async function commitPosting(db: Database, command: PostCommand, before: StocktakePreview) {
  const input = stocktakePostSchema.parse(command.input),
    { id, actor } = command;
  const operation = await createOperation(db, 'stocktake.post', id, input.reason, actor);
  const changed =
    (await postCountedInventory(db, operation, before.stocktake.warehouseCode)) +
    (await postDiscoveredInventory(db, operation, before.stocktake.warehouseCode));
  ensure(changed === before.stocktake.changedCount, 'STOCKTAKE_CHANGE_MISMATCH', '差异行数变化，操作已回滚');
  await db.run(
    `UPDATE stocktakes SET status='completed',revision=revision+1,closed_at=UTC_TIMESTAMP(3),
    close_reason=?,operation_id=? WHERE id=?`,
    [input.reason, operation.id, id],
  );
  await db.run(
    'UPDATE stocktake_windows SET released_at=UTC_TIMESTAMP(3) WHERE stocktake_id=? AND released_at IS NULL',
    [id],
  );
  const after = await getStocktake(db, id);
  if (before.unposted.length)
    await audit(db, actor, {
      action: 'stocktake.snapshot-basis.acknowledge',
      targetId: id,
      before: { snapshotAt: before.stocktake.snapshotAt, previewToken: before.token, unposted: before.unposted },
      after: { acknowledged: true, reason: input.reason, operationId: operation.id },
    });
  await audit(db, actor, { action: 'stocktake.post', targetId: id, before, after });
  return after;
}
export async function postStocktake(db: Database, command: PostCommand) {
  const { id, key, actor } = command,
    input = stocktakePostSchema.parse(command.input),
    payload = { id, ...input };
  return db.transaction(async (tx) => {
    await lockInventoryWriter(tx);
    const row = await tx.get('SELECT warehouse_code FROM stocktakes WHERE id=? FOR UPDATE', [id]);
    ensure(row, 'STOCKTAKE_NOT_FOUND', '盘点单不存在');
    await lockUnpostedOrders(tx, String(row.warehouse_code));
    const replay = await replayCommand(tx, 'stocktake.post', key, payload, actor, stocktakeSchema);
    if (replay) return replay;
    await lockCounting(tx, id);
    const before = await stocktakePreview(tx, id);
    ensure(
      !before.blockers.length,
      before.blockers[0]?.code ?? 'STOCKTAKE_BLOCKED',
      before.blockers[0]?.message ?? '盘点无法回写',
    );
    ensure(
      before.token === input.expectedToken,
      'STALE_STOCKTAKE_PREVIEW',
      '实盘或未入账清单已变化，请刷新预览并重新核对；输入保留',
    );
    ensure(
      !before.unposted.length || input.acknowledgeSnapshotBasis,
      'UNPOSTED_DOCUMENTS_REQUIRE_ACK',
      '存在快照后的未入账收发货，默认禁止回写；请处理或明确确认“按快照时点口径回写”',
    );
    const after = await commitPosting(tx, { ...command, input }, before);
    await saveCommand(tx, 'stocktake.post', key, payload, actor, after);
    return after;
  });
}
