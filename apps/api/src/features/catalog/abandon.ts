import { randomUUID } from 'node:crypto';
import { catalogAbandonInputSchema, catalogAbandonResultSchema, catalogCandidateCopy } from '@wms/contracts';
import type { Database } from '../../db/mysql.ts';
import { audit, type Actor } from '../../shared/audit.ts';
import { AppError } from '../../shared/errors.ts';
import { replayCommand, saveCommand } from '../../shared/idempotency.ts';
import { getVersion } from './repository.ts';

interface AbandonCommand {
  versionId: number;
  reason: string;
  key: string;
  actor: Actor;
}
export async function abandonCandidate(db: Database, command: AbandonCommand) {
  const input = { versionId: command.versionId, ...catalogAbandonInputSchema.parse({ reason: command.reason }) };
  return db.transaction(async (tx) => {
    await tx.get("SELECT value FROM app_meta WHERE meta_key='identity' FOR UPDATE");
    const old = await replayCommand(
      tx,
      'catalog.abandon',
      command.key,
      input,
      command.actor,
      catalogAbandonResultSchema,
    );
    if (old) return old;
    const version = await getVersion(tx, input.versionId);
    if (version.status === 'abandoned') throw new AppError('CATALOG_ABANDONED', catalogCandidateCopy.abandoned, 422);
    if (version.status !== 'validated')
      throw new AppError('CATALOG_NOT_ABANDONABLE', catalogCandidateCopy.notAbandonable, 422);
    const result = await recordAbandonment(tx, { ...command, ...input });
    await saveCommand(tx, 'catalog.abandon', command.key, input, command.actor, result);
    return result;
  });
}
async function recordAbandonment(tx: Database, command: AbandonCommand) {
  const operationId = randomUUID();
  await tx.run(
    `INSERT INTO catalog_candidate_abandons(version_id,reason,actor,operation_id,created_at)
    VALUES(?,?,?,?,UTC_TIMESTAMP(3))`,
    [command.versionId, command.reason, command.actor.username, operationId],
  );
  const result = catalogAbandonResultSchema.parse({
    versionId: command.versionId,
    operationId,
    abandonment: (await getVersion(tx, command.versionId)).abandonment,
  });
  await audit(tx, command.actor, {
    action: 'catalog.abandon',
    targetId: String(command.versionId),
    before: { status: 'validated' },
    after: { status: 'abandoned', reason: command.reason, versionId: command.versionId },
  });
  return result;
}
