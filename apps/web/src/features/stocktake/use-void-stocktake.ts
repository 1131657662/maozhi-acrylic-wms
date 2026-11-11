import { useSubmissionKey } from '../../components/form-protection/use-submission-key';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { stocktakeSchema, type Stocktake } from '@wms/contracts';
import { request } from '../../api/client';
import { stocktakeKeys } from './keys';
import { webListKeys } from '../web-lists/keys';

export function useVoidStocktake() {
  const client = useQueryClient();
  const intent = useSubmissionKey();
  return useMutation({
    mutationFn: ({ take, reason }: { take: Stocktake; reason: string }) => {
      const path = `/stocktakes/${take.id}/void`,
        body = JSON.stringify({ reason: reason.trim(), expectedRevision: take.revision });
      return request(path, stocktakeSchema, {
        method: 'POST',
        body,
        headers: { 'Idempotency-Key': intent.value() },
      });
    },
    onSuccess: () => {
      intent.clear();
      return Promise.all([stocktakeKeys, webListKeys].map((k) => client.invalidateQueries({ queryKey: k._def })));
    },
  });
}
