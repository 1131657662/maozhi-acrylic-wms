import { catalogCandidateCopy, type CatalogUploadResult } from '@wms/contracts';
import type { Database } from '../../db/mysql.ts';
import { getVersion } from './repository.ts';

// 上传身份与查重结果保持不变，候选状态始终投影为当前的追加式证据。
export async function projectUploadResult(db: Database, result: CatalogUploadResult): Promise<CatalogUploadResult> {
  const id = result.version?.versionId ?? result.matchedVersionId;
  if (id === null) return result;
  const version = await getVersion(db, id);
  if (result.duplicate) {
    const abandoned = version.status === 'abandoned';
    return {
      ...result,
      message: abandoned ? catalogCandidateCopy.duplicateAbandoned : `与第 ${id} 版内容一致`,
      version: abandoned ? version : null,
    };
  }
  return { ...result, version };
}
