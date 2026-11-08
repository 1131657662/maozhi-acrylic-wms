import { useRef } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { catalogUploadResultSchema } from '@wms/contracts';
import { ApiError, request } from '../../api/client';
import { catalogKeys } from './keys';

interface UploadInput {
  file: File;
  encoding: string;
  rebuildOfVersionId?: number;
}
export function useUpload() {
  const client = useQueryClient();
  const pending = useRef<{ input: UploadInput; key: string } | null>(null);
  return useMutation({
    mutationFn: (input: UploadInput) => {
      const old = pending.current;
      if (
        !old ||
        old.input.file !== input.file ||
        old.input.encoding !== input.encoding ||
        old.input.rebuildOfVersionId !== input.rebuildOfVersionId
      )
        pending.current = { input, key: crypto.randomUUID() };
      return sendUpload(input, pending.current!.key);
    },
    onSuccess: () => {
      pending.current = null;
      return client.invalidateQueries({ queryKey: catalogKeys._def });
    },
  });
}
async function sendUpload(input: UploadInput, key: string) {
  const params = new URLSearchParams({ encoding: input.encoding, fileName: input.file.name });
  if (input.rebuildOfVersionId) params.set('rebuildOfVersionId', String(input.rebuildOfVersionId));
  try {
    return await request(`/catalog/uploads?${params}`, catalogUploadResultSchema, {
      method: 'POST',
      body: input.file,
      headers: { 'Content-Type': 'application/octet-stream', 'Idempotency-Key': key },
    });
  } catch (error) {
    if (error instanceof ApiError && error.status < 500) throw error;
    try {
      return await request(`/catalog/uploads/${key}`, catalogUploadResultSchema);
    } catch {
      throw new Error('上传结果未确认；文件已保留，请重试核验（沿用原上传编号）');
    }
  }
}
