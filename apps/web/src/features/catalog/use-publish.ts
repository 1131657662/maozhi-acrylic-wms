import { useRef } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { catalogPublishResultSchema, catalogUploadResultSchema, type CatalogVersion } from '@wms/contracts';
import { ApiError, request } from '../../api/client';
import { catalogKeys } from './keys';

export function usePublish(uploadId: string) {
  const client = useQueryClient();
  const pending = useRef<{ version: number; key: string } | null>(null);
  return useMutation({
    mutationFn: async (version: CatalogVersion) => {
      if (pending.current?.version !== version.versionId)
        pending.current = { version: version.versionId, key: crypto.randomUUID() };
      await publishAndRecover(version, { key: pending.current.key, uploadId });
    },
    onSettled: () => client.invalidateQueries({ queryKey: catalogKeys._def }),
  });
}
async function publishAndRecover(version: CatalogVersion, input: { key: string; uploadId: string }) {
  try {
    await request(`/catalog/versions/${version.versionId}/publish`, catalogPublishResultSchema, {
      method: 'POST',
      headers: { 'Idempotency-Key': input.key },
      body: JSON.stringify({ baseRevision: version.baseRevision, contentSha256: version.contentSha256 }),
    });
  } catch (error) {
    if (error instanceof ApiError && error.status >= 400 && error.status < 500) throw error;
    const result = await request(`/catalog/uploads/${input.uploadId}`, catalogUploadResultSchema).catch(() => null);
    if (result?.version?.status === 'published') return;
    throw new Error('发布未完成或结果待核验；当前文件和预览已保留，请重试（沿用原发布编号）');
  }
}
