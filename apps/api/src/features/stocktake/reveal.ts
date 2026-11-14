import { revealStocktakeSchema, stocktakePreviewSchema, stocktakeCopy, type Stocktake } from '@wms/contracts';
import type { Database } from '../../db/mysql.ts';
import { audit, type Actor } from '../../shared/audit.ts';
import { ensure } from '../../shared/errors.ts';
import { replayCommand, saveCommand } from '../../shared/idempotency.ts';
import { lockCounting } from './window.ts';
import { getStocktake } from './read-model.ts';
import { stocktakePreview } from './preview.ts';

interface RevealCommand {
  id: string;
  input: unknown;
  key: string;
  actor: Actor;
}
function validateReveal(take: Stocktake, expectedRevision: number): void {
  ensure(take.mode === 'blind', 'STOCKTAKE_NOT_BLIND', stocktakeCopy.onlyBlind);
  ensure(take.revealedAt === null, 'STOCKTAKE_ALREADY_REVEALED', stocktakeCopy.alreadyRevealed);
  ensure(take.revision === expectedRevision, 'STALE_STOCKTAKE', stocktakeCopy.stale);
  ensure(take.recordedCount === take.lineCount, 'STOCKTAKE_INCOMPLETE', stocktakeCopy.incomplete);
}
export async function revealStocktake(db: Database, command: RevealCommand) {
  const { id, key, actor } = command;
  const payload = { id, ...revealStocktakeSchema.parse(command.input) };
  return db.transaction(async (tx) => {
    await tx.get('SELECT id FROM stocktakes WHERE id=? FOR UPDATE', [id]);
    const previous = await replayCommand(tx, 'stocktake.reveal', key, payload, actor, stocktakePreviewSchema);
    if (previous) return previous;
    await lockCounting(tx, id);
    validateReveal(await getStocktake(tx, id), payload.expectedRevision);
    await tx.run('UPDATE stocktakes SET revealed_at=UTC_TIMESTAMP(3),revision=revision+1 WHERE id=?', [id]);
    const after = await stocktakePreview(tx, id);
    await audit(tx, actor, {
      action: 'stocktake.reveal',
      targetId: id,
      before: { mode: 'blind', revealedAt: null },
      after: { number: after.stocktake.number, mode: 'blind', revealedAt: after.stocktake.revealedAt },
    });
    await saveCommand(tx, 'stocktake.reveal', key, payload, actor, after);
    return after;
  });
}
