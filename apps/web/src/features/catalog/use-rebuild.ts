import { useRef } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { catalogUploadResultSchema } from '@wms/contracts';
import { request } from '../../api/client';
import { catalogKeys } from './keys';

export function useRebuild(versionId: number) {
  const client = useQueryClient();
  const key = useRef<string | null>(null);
  return useMutation({
    mutationFn: () => {
      key.current ??= crypto.randomUUID();
      return request(`/catalog/versions/${versionId}/rebuild`, catalogUploadResultSchema, {
        method: 'POST',
        headers: { 'Idempotency-Key': key.current },
        body: JSON.stringify({}),
      });
    },
    onSuccess: () => client.invalidateQueries({ queryKey: catalogKeys._def }),
  });
}
