import { useSubmissionKey } from '../../components/form-protection/use-submission-key';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { detailSchema, type Detail } from '@wms/contracts';
import { request } from '../../api/client';
import { outboundKeys } from './keys';
import { stockKeys } from '../stock/keys';
import { webListKeys } from '../web-lists/keys';
import { lifecycleKeys } from '../document-lifecycle/keys';
export function useConfirm() {
  const client = useQueryClient();
  const intent = useSubmissionKey();
  return useMutation({
    mutationFn: (order: Detail) => {
      const body = JSON.stringify({ revision: order.revision, digest: order.digest });
      return request(`/outbound/${order.id}/confirm`, detailSchema, {
        method: 'POST',
        headers: { 'Idempotency-Key': intent.value() },
        body,
      });
    },
    onSuccess: async () => {
      intent.clear();
      await Promise.all([
        client.invalidateQueries({ queryKey: lifecycleKeys._def }),
        client.invalidateQueries({ queryKey: outboundKeys._def }),
        client.invalidateQueries({ queryKey: stockKeys._def }),
        client.invalidateQueries({ queryKey: webListKeys._def }),
      ]);
    },
  });
}
