import { useRef } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { catalogAbandonResultSchema } from '@wms/contracts';
import { request } from '../../api/client';
import { catalogKeys } from './keys';

export function useAbandon(versionId: number) {
  const client = useQueryClient();
  const pending = useRef<{ reason: string; key: string } | null>(null);
  return useMutation({
    mutationFn: (reason: string) => {
      if (pending.current?.reason !== reason) pending.current = { reason, key: crypto.randomUUID() };
      return request(`/catalog/versions/${versionId}/abandon`, catalogAbandonResultSchema, {
        method: 'POST',
        headers: { 'Idempotency-Key': pending.current.key },
        body: JSON.stringify({ reason }),
      });
    },
    onSettled: () => client.invalidateQueries({ queryKey: catalogKeys._def }),
  });
}
