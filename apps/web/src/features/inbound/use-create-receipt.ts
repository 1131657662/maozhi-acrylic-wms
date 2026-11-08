import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useRef } from 'react';
import { createInboundSchema, inboundReceiptSchema, type CreateInbound } from '@wms/contracts';
import { request } from '../../api/client';
import { stockKeys } from '../stock/keys';
import { inboundKeys } from './keys';

export function useCreateReceipt() {
  const client = useQueryClient();
  const pending = useRef<{ body: string; key: string } | null>(null);
  return useMutation({
    mutationFn: (input: CreateInbound) => {
      const body = JSON.stringify(createInboundSchema.parse(input));
      if (pending.current?.body !== body) pending.current = { body, key: crypto.randomUUID() };
      return request('/inbound', inboundReceiptSchema, {
        method: 'POST',
        headers: { 'Idempotency-Key': pending.current.key }, body,
      });
    },
    onSuccess: () => {
      pending.current = null;
      void client.invalidateQueries({ queryKey: inboundKeys._def });
      void client.invalidateQueries({ queryKey: stockKeys._def });
    },
  });
}
