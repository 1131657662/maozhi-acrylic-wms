import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useRef } from 'react';
import { inboundReceiptSchema } from '@wms/contracts';
import { request } from '../../api/client';
import { inboundKeys } from './keys';
import { stockKeys } from '../stock/keys';

export function useConfirmReceipt(id: string) {
  const client = useQueryClient();
  const key = useRef(crypto.randomUUID());
  return useMutation({
    mutationFn: () =>
      request(`/inbound/${id}/confirm`, inboundReceiptSchema, {
        method: 'POST',
        headers: { 'Idempotency-Key': key.current },
        body: '{}',
      }),
    onSuccess: async () => {
      await Promise.all([
        client.invalidateQueries({ queryKey: inboundKeys._def }),
        client.invalidateQueries({ queryKey: stockKeys._def }),
      ]);
    },
  });
}
