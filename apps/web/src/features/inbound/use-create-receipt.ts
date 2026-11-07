import { useMutation, useQueryClient } from '@tanstack/react-query';
import { createInboundSchema, inboundReceiptSchema, type CreateInbound } from '@wms/contracts';
import { request } from '../../api/client';
import { outboundKeys } from '../outbound/keys';
import { inboundKeys } from './keys';

export function useCreateReceipt() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateInbound) =>
      request('/inbound', inboundReceiptSchema, {
        method: 'POST',
        headers: { 'Idempotency-Key': crypto.randomUUID() },
        body: JSON.stringify(createInboundSchema.parse(input)),
      }),
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: inboundKeys._def });
      void client.invalidateQueries({ queryKey: outboundKeys.stock.queryKey });
    },
  });
}
