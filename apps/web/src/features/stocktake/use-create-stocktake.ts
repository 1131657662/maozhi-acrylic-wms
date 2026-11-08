import { useRef } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { stocktakeSchema, type CreateStocktake } from '@wms/contracts';
import { request } from '../../api/client';
import { stocktakeKeys } from './keys';

export function useCreateStocktake() {
  const client = useQueryClient(),
    pending = useRef({ body: '', key: '' });
  return useMutation({
    mutationFn: (input: CreateStocktake) => {
      const body = JSON.stringify(input);
      if (pending.current.body !== body) pending.current = { body, key: crypto.randomUUID() };
      return request('/stocktakes', stocktakeSchema, {
        method: 'POST',
        body,
        headers: { 'Idempotency-Key': pending.current.key },
      });
    },
    onSuccess: () => client.invalidateQueries({ queryKey: stocktakeKeys._def }),
  });
}
