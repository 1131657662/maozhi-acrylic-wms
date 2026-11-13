import { catalogUploadResultSchema, type CatalogUploadResult } from '@wms/contracts';
import type { Database } from '../../db/mysql.ts';
import { audit, type Actor } from '../../shared/audit.ts';
import { ensure } from '../../shared/errors.ts';
import { replayCommand, saveCommand } from '../../shared/idempotency.ts';
import { parseCatalog } from './parse.ts';
import { contentHash, bytesHash, type CatalogEntry } from './hash.ts';
import { getVersion, head, insertEntries, readEntries } from './repository.ts';
import { catalogDiff, diffCounts } from './diff.ts';
import { projectUploadResult } from './upload-projection.ts';

export interface UploadCommand {
  bytes: Buffer;
  encoding: string;
  fileName: string;
  key: string;
  rebuildOfVersionId?: number;
  actor: Actor;
}
export async function uploadCatalog(db: Database, command: UploadCommand): Promise<CatalogUploadResult> {
  const entries = parseCatalog(command.bytes, command.encoding);
  const input = {
    sha: bytesHash(command.bytes),
    encoding: command.encoding,
    rebuildOfVersionId: command.rebuildOfVersionId ?? null,
  };
  return db.transaction(async (tx) => {
    await tx.get("SELECT value FROM app_meta WHERE meta_key='identity' FOR UPDATE");
    const old = await replayCommand(tx, 'catalog.upload', command.key, input, command.actor, catalogUploadResultSchema);
    if (old) return projectUploadResult(tx, old);
    const digest = contentHash(entries);
    const match = await tx.get(
      "SELECT version_id FROM catalog_versions WHERE content_sha256=? AND status<>'staging' ORDER BY version_id DESC LIMIT 1",
      [digest],
    );
    const result =
      match && !command.rebuildOfVersionId
        ? await duplicate(tx, command.key, Number(match.version_id))
        : await createCandidate(tx, { command, entries, digest });
    await saveCommand(tx, 'catalog.upload', command.key, input, command.actor, result);
    return result;
  });
}
async function duplicate(db: Database, key: string, id: number): Promise<CatalogUploadResult> {
  return projectUploadResult(db, {
    uploadId: key,
    duplicate: true,
    matchedVersionId: id,
    message: `与第 ${id} 版内容一致`,
    version: null,
  });
}
async function createCandidate(
  db: Database,
  input: { command: UploadCommand; entries: CatalogEntry[]; digest: string },
): Promise<CatalogUploadResult> {
  const { command, entries, digest } = input;
  if (command.rebuildOfVersionId)
    ensure(
      (await getVersion(db, command.rebuildOfVersionId)).contentSha256 === digest,
      'CATALOG_REBUILD_MISMATCH',
      '二次确认的历史版本与当前文件内容不一致',
    );
  const base = await head(db);
  ensure(base, 'CATALOG_MIGRATION_NOT_READY', 'v1 目录尚未初始化');
  const counts = diffCounts(catalogDiff(await readEntries(db, base.versionId), entries));
  const id = await insertCandidate(db, { ...input, base, counts });
  await insertEntries(db, id, entries);
  await db.run("UPDATE catalog_versions SET status='validated' WHERE version_id=?", [id]);
  const version = await getVersion(db, id);
  await auditUpload(db, { command, version, baseVersion: base.versionId });
  return {
    uploadId: command.key,
    duplicate: false,
    matchedVersionId: null,
    message: '完整目录已校验，请核对差异后发布',
    version,
  };
}
interface CandidateRow {
  command: UploadCommand;
  entries: CatalogEntry[];
  digest: string;
  base: { versionId: number; revision: number };
  counts: ReturnType<typeof diffCounts>;
}
async function insertCandidate(db: Database, input: CandidateRow): Promise<number> {
  await db.run(
    `INSERT INTO catalog_versions(upload_uuid,base_version_id,base_revision,status,source_kind,source_name,source_encoding,
    source_sha256,content_sha256,parser_version,source_bytes,entry_count,spec_count,diff_json,actor,created_at)
    VALUES(?,?,?,'staging','upload',?,?,?,?,'txt-v1',?,?,?,?,?,UTC_TIMESTAMP(3))`,
    candidateValues(input),
  );
  return Number(
    (await db.get('SELECT version_id FROM catalog_versions WHERE upload_uuid=?', [input.command.key]))!.version_id,
  );
}
function candidateValues({ command, entries, digest, base, counts }: CandidateRow) {
  return [
    command.key,
    base.versionId,
    base.revision,
    command.fileName,
    command.encoding,
    bytesHash(command.bytes),
    digest,
    command.bytes,
    entries.length,
    new Set(entries.map((e) => e.sourceSpec)).size,
    JSON.stringify(counts),
    command.actor.username,
  ];
}
async function auditUpload(
  db: Database,
  {
    command,
    version,
    baseVersion,
  }: { command: UploadCommand; version: NonNullable<CatalogUploadResult['version']>; baseVersion: number },
) {
  await audit(db, command.actor, {
    action: 'catalog.upload',
    targetId: String(version.versionId),
    before: { activeVersion: baseVersion },
    after: {
      versionId: version.versionId,
      entryCount: version.entryCount,
      contentSha256: version.contentSha256,
      rebuildOfVersionId: command.rebuildOfVersionId ?? null,
    },
  });
}
