import { useRef } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { stocktakeSchema, type StocktakePost } from '@wms/contracts';
import { request } from '../../api/client';
import { stocktakeKeys } from './keys';
import { webListKeys } from '../web-lists/keys';
import { stockKeys } from '../stock/keys';

export function usePostStocktake() {
  const client = useQueryClient(),
    pending = useRef({ body: '', path: '', key: '' });
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: StocktakePost }) => {
      const path = `/stocktakes/${id}/post`,
        body = JSON.stringify(input);
      if (pending.current.body !== body || pending.current.path !== path)
        pending.current = { body, path, key: crypto.randomUUID() };
      return request(path, stocktakeSchema, {
        method: 'POST',
        body,
        headers: { 'Idempotency-Key': pending.current.key },
      });
    },
    onSuccess: () =>
      Promise.all([stocktakeKeys, webListKeys, stockKeys].map((k) => client.invalidateQueries({ queryKey: k._def }))),
  });
}
