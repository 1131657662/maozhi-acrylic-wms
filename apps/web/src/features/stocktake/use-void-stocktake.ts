import { useRef } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { stocktakeSchema, type Stocktake } from '@wms/contracts';
import { request } from '../../api/client';
import { stocktakeKeys } from './keys';
import { webListKeys } from '../web-lists/keys';

export function useVoidStocktake() {
  const client = useQueryClient(),
    pending = useRef({ body: '', path: '', key: '' });
  return useMutation({
    mutationFn: ({ take, reason }: { take: Stocktake; reason: string }) => {
      const path = `/stocktakes/${take.id}/void`,
        body = JSON.stringify({ reason: reason.trim(), expectedRevision: take.revision });
      if (pending.current.body !== body || pending.current.path !== path)
        pending.current = { body, path, key: crypto.randomUUID() };
      return request(path, stocktakeSchema, {
        method: 'POST',
        body,
        headers: { 'Idempotency-Key': pending.current.key },
      });
    },
    onSuccess: () =>
      Promise.all([stocktakeKeys, webListKeys].map((k) => client.invalidateQueries({ queryKey: k._def }))),
  });
}
