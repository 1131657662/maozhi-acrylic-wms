import { useSubmissionKey } from '../../components/form-protection/use-submission-key';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { createInboundSchema, inboundReceiptSchema, type CreateInbound } from '@wms/contracts';
import { request } from '../../api/client';
import { stockKeys } from '../stock/keys';
import { inboundKeys } from './keys';
import { webListKeys } from '../web-lists/keys';

export function useCreateReceipt() {
  const client = useQueryClient();
  const intent = useSubmissionKey();
  return useMutation({
    mutationFn: (input: CreateInbound) => {
      const body = JSON.stringify(createInboundSchema.parse(input));
      return request('/inbound', inboundReceiptSchema, {
        method: 'POST',
        headers: { 'Idempotency-Key': intent.value() },
        body,
      });
    },
    onSuccess: () => {
      intent.clear();
      void client.invalidateQueries({ queryKey: inboundKeys._def });
      void client.invalidateQueries({ queryKey: stockKeys._def });
      void client.invalidateQueries({ queryKey: webListKeys._def });
    },
  });
}
