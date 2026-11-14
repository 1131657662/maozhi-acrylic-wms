import { useRef } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { publicStocktakePreviewSchema } from '@wms/contracts';
import { request } from '../../api/client';
import { stocktakeKeys } from './keys';
import { auditKeys } from '../audit/keys';

export function useReveal(id: string) {
  const client = useQueryClient();
  const pending = useRef<{ revision: number; key: string } | null>(null);
  return useMutation({
    mutationFn: (expectedRevision: number) => {
      if (pending.current?.revision !== expectedRevision)
        pending.current = { revision: expectedRevision, key: crypto.randomUUID() };
      return request(`/stocktake/${id}/reveal`, publicStocktakePreviewSchema, {
        method: 'POST',
        headers: { 'Idempotency-Key': pending.current.key },
        body: JSON.stringify({ expectedRevision }),
      });
    },
    onSettled: () =>
      Promise.all([stocktakeKeys, auditKeys].map((keys) => client.invalidateQueries({ queryKey: keys._def }))),
  });
}
