import type { Database } from '../../db/mysql.ts';
import type { Actor } from '../../shared/audit.ts';
import { AppError } from '../../shared/errors.ts';
import { getVersion } from './repository.ts';
import { uploadCatalog } from './upload.ts';

export async function rebuildCandidate(db: Database, input: { versionId: number; key: string; actor: Actor }) {
  await getVersion(db, input.versionId);
  const source = await db.get(
    'SELECT source_bytes,source_encoding,source_name,source_kind FROM catalog_versions WHERE version_id=?',
    [input.versionId],
  );
  if (source?.source_kind !== 'upload' || !Buffer.isBuffer(source.source_bytes))
    throw new AppError('CATALOG_REBUILD_UNAVAILABLE', '此版本没有可重建的上传原文，请重新上传完整文件', 422);
  return uploadCatalog(db, {
    bytes: source.source_bytes,
    encoding: String(source.source_encoding),
    fileName: String(source.source_name),
    rebuildOfVersionId: input.versionId,
    key: input.key,
    actor: input.actor,
  });
}
