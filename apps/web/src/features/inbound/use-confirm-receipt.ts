import { useSubmissionKey } from '../../components/form-protection/use-submission-key';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { inboundReceiptSchema } from '@wms/contracts';
import { request } from '../../api/client';
import { inboundKeys } from './keys';
import { stockKeys } from '../stock/keys';
import { webListKeys } from '../web-lists/keys';
import { lifecycleKeys } from '../document-lifecycle/keys';

export function useConfirmReceipt(id: string) {
  const client = useQueryClient();
  const intent = useSubmissionKey();
  return useMutation({
    mutationFn: () =>
      request(`/inbound/${id}/confirm`, inboundReceiptSchema, {
        method: 'POST',
        headers: { 'Idempotency-Key': intent.value() },
        body: '{}',
      }),
    onSuccess: async () => {
      intent.clear();
      await Promise.all([
        client.invalidateQueries({ queryKey: lifecycleKeys._def }),
        client.invalidateQueries({ queryKey: inboundKeys._def }),
        client.invalidateQueries({ queryKey: stockKeys._def }),
        client.invalidateQueries({ queryKey: webListKeys._def }),
      ]);
    },
  });
}
