import type { Database } from '../../db/mysql.ts';
import { ensure, AppError } from '../../shared/errors.ts';
import { catalogUploadResultSchema } from '@wms/contracts';
import { getVersion, head, entryRow } from './repository.ts';
import { publicationGate } from './gate.ts';
import { queryVersionDiff } from './diff-query.ts';
import { catalogDiffQuerySchema } from '@wms/contracts';

export async function overview(db: Database, enabled: boolean) {
  return db.transaction(async (tx) => {
    const current = await head(tx);
    return {
      current: current ? await getVersion(tx, current.versionId) : null,
      revision: current?.revision ?? 0,
      gate: await publicationGate(tx, enabled),
    };
  });
}
export async function uploadResult(db: Database, id: string, username: string) {
  const row = await db.get('SELECT result_json FROM idempotent_commands WHERE command_key=?', [
    `catalog.upload:${username}:${id}`,
  ]);
  if (!row) throw new AppError('NOT_FOUND', '未找到上传结果，请使用原文件与原幂等键重试', 404);
  const result = catalogUploadResultSchema.parse(JSON.parse(String(row.result_json)));
  return { ...result, version: result.version ? await getVersion(db, result.version.versionId) : null };
}
export async function versionDiff(
  db: Database,
  input: { versionId: number; kind: string; after: string; limit: number },
) {
  return queryVersionDiff(db, {
    versionId: input.versionId,
    ...catalogDiffQuerySchema.parse({ kind: input.kind, afterBarcode: input.after, limit: input.limit }),
  });
}
export async function manifest(db: Database) {
  const current = await head(db);
  ensure(current, 'CATALOG_MIGRATION_NOT_READY', '目录尚未初始化');
  const version = await getVersion(db, current.versionId);
  return {
    versionId: version.versionId,
    entryCount: version.entryCount,
    contentSha256: version.contentSha256,
    hashVersion: 'json-entries-v1',
  };
}
export async function versionEntries(db: Database, input: { versionId: number; after: string; limit: number }) {
  const version = await getVersion(db, input.versionId);
  ensure(version.status === 'published', 'CATALOG_VERSION_UNAVAILABLE', '此目录版本尚未发布');
  const rows = await db.all('SELECT * FROM catalog_entries WHERE version_id=? AND barcode>? ORDER BY barcode LIMIT ?', [
    input.versionId,
    input.after,
    input.limit + 1,
  ]);
  const items = rows
    .slice(0, input.limit)
    .map(entryRow)
    .map((e) => ({
      barcode: e.barcode,
      sourceSpec: e.sourceSpec,
      weightGrams: e.weightGrams,
      catalogVersion: input.versionId,
    }));
  return {
    items,
    nextBarcode: rows.length > input.limit ? items.at(-1)!.barcode : null,
    versionId: input.versionId,
    contentSha256: version.contentSha256,
    entryCount: version.entryCount,
  };
}
