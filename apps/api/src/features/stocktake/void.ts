import { stocktakeSchema, voidStocktakeSchema } from '@wms/contracts';
import type { Database } from '../../db/mysql.ts';
import { audit, type Actor } from '../../shared/audit.ts';
import { ensure } from '../../shared/errors.ts';
import { replayCommand, saveCommand } from '../../shared/idempotency.ts';
import { lockInventoryWriter } from '../inventory/operation.ts';
import { lockCounting } from './window.ts';
import { getStocktake } from './read-model.ts';

interface VoidCommand {
  id: string;
  input: unknown;
  key: string;
  actor: Actor;
}
export async function voidStocktake(db: Database, command: VoidCommand) {
  const { id, key, actor } = command,
    payload = { id, ...voidStocktakeSchema.parse(command.input) };
  return db.transaction(async (tx) => {
    await lockInventoryWriter(tx);
    await tx.get('SELECT id FROM stocktakes WHERE id=? FOR UPDATE', [id]);
    const replay = await replayCommand(tx, 'stocktake.void', key, payload, actor, stocktakeSchema);
    if (replay) return replay;
    await lockCounting(tx, id);
    const before = await getStocktake(tx, id);
    ensure(before.revision === payload.expectedRevision, 'STALE_STOCKTAKE', '盘点已变化，请刷新核对；原因保留');
    await tx.run(
      "UPDATE stocktakes SET status='voided',revision=revision+1,closed_at=UTC_TIMESTAMP(3),close_reason=? WHERE id=?",
      [payload.reason, id],
    );
    await tx.run(
      'UPDATE stocktake_windows SET released_at=UTC_TIMESTAMP(3) WHERE stocktake_id=? AND released_at IS NULL',
      [id],
    );
    const after = await getStocktake(tx, id);
    await audit(tx, actor, { action: 'stocktake.void', targetId: id, before, after });
    await saveCommand(tx, 'stocktake.void', key, payload, actor, after);
    return after;
  });
}
