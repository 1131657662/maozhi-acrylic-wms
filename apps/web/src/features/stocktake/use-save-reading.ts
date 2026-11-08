import { useRef } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { stocktakeLineSchema, type SaveReading } from '@wms/contracts';
import { request } from '../../api/client';
import { stocktakeKeys } from './keys';

export function useSaveReading() {
  const client = useQueryClient(),
    pending = useRef({ body: '', path: '', key: '' });
  return useMutation({
    mutationFn: ({ id, productCode, input }: { id: string; productCode: string; input: SaveReading }) => {
      const body = JSON.stringify(input),
        path = `/stocktakes/${id}/lines/${encodeURIComponent(productCode)}`;
      if (pending.current.body !== body || pending.current.path !== path)
        pending.current = { body, path, key: crypto.randomUUID() };
      return request(path, stocktakeLineSchema, {
        method: 'PUT',
        body,
        headers: { 'Idempotency-Key': pending.current.key },
      });
    },
    onSuccess: () => client.invalidateQueries({ queryKey: stocktakeKeys._def }),
  });
}
