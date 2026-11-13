import { randomUUID } from 'node:crypto';
import { catalogPublishResultSchema, catalogCandidateCopy, type CatalogVersion } from '@wms/contracts';
import type { Database } from '../../db/mysql.ts';
import { audit, type Actor } from '../../shared/audit.ts';
import { ensure, AppError } from '../../shared/errors.ts';
import { replayCommand, saveCommand } from '../../shared/idempotency.ts';
import { getVersion, readEntries } from './repository.ts';
import { contentHash } from './hash.ts';
import { assertPublicationGate } from './gate.ts';

interface PublishCommand {
  versionId: number;
  baseRevision: number;
  contentSha256: string;
  key: string;
  actor: Actor;
  enabled: boolean;
}
export async function publishCatalog(db: Database, command: PublishCommand) {
  const input = {
    versionId: command.versionId,
    baseRevision: command.baseRevision,
    contentSha256: command.contentSha256,
  };
  return db.transaction(async (tx) => {
    await tx.get("SELECT value FROM app_meta WHERE meta_key='identity' FOR UPDATE");
    const old = await replayCommand(
      tx,
      'catalog.publish',
      command.key,
      input,
      command.actor,
      catalogPublishResultSchema,
    );
    if (old) return old;
    const current = await tx.get('SELECT * FROM catalog_head WHERE id=1 FOR UPDATE');
    await tx.get('SELECT version_id FROM catalog_versions WHERE version_id=? FOR UPDATE', [command.versionId]);
    const version = await getVersion(tx, command.versionId);
    if (version.status === 'abandoned') throw new AppError('CATALOG_ABANDONED', catalogCandidateCopy.abandoned, 422);
    await assertPublicationGate(tx, command.enabled);
    ensure(
      current && Number(current.revision) === command.baseRevision,
      'CATALOG_BASE_CHANGED',
      catalogCandidateCopy.baseChanged,
    );
    await checkCandidate(tx, version, { ...input, currentVersion: Number(current.active_version_id) });
    return commitPublication(tx, command, version);
  });
}
async function checkCandidate(
  db: Database,
  version: CatalogVersion,
  input: { contentSha256: string; currentVersion: number; baseRevision: number },
) {
  ensure(
    version.status === 'validated' && version.versionId > input.currentVersion,
    'CATALOG_NOT_PUBLISHABLE',
    '该版本不能再次发布或倒退发布',
  );
  ensure(
    version.baseRevision === input.baseRevision && version.baseVersionId === input.currentVersion,
    'CATALOG_BASE_CHANGED',
    catalogCandidateCopy.baseChanged,
  );
  const entries = await readEntries(db, version.versionId);
  ensure(
    version.contentSha256 === input.contentSha256 &&
      entries.length === version.entryCount &&
      contentHash(entries) === version.contentSha256,
    'CATALOG_NOT_PUBLISHABLE',
    '候选完整性核验失败，当前目录未变',
  );
}
async function commitPublication(db: Database, command: PublishCommand, version: CatalogVersion) {
  const operationId = randomUUID();
  await db.run("UPDATE catalog_versions SET status='published',published_at=UTC_TIMESTAMP(3) WHERE version_id=?", [
    version.versionId,
  ]);
  await db.run('UPDATE catalog_head SET active_version_id=?,revision=revision+1 WHERE id=1', [version.versionId]);
  const result = {
    activeVersion: version.versionId,
    revision: command.baseRevision + 1,
    operationId,
    publishedAt: (await getVersion(db, version.versionId)).publishedAt!,
  };
  await audit(db, command.actor, {
    action: 'catalog.publish',
    targetId: operationId,
    before: { versionId: version.baseVersionId },
    after: { ...result, diffCounts: version.diffCounts },
  });
  await saveCommand(
    db,
    'catalog.publish',
    command.key,
    { versionId: command.versionId, baseRevision: command.baseRevision, contentSha256: command.contentSha256 },
    command.actor,
    result,
  );
  return result;
}
