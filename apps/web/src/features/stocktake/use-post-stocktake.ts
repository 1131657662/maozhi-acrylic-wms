import { useSubmissionKey } from '../../components/form-protection/use-submission-key';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { publicStocktakeSchema, type StocktakePost } from '@wms/contracts';
import { request } from '../../api/client';
import { stocktakeKeys } from './keys';
import { webListKeys } from '../web-lists/keys';
import { stockKeys } from '../stock/keys';

export function usePostStocktake() {
  const client = useQueryClient();
  const intent = useSubmissionKey();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: StocktakePost }) => {
      const path = `/stocktakes/${id}/post`,
        body = JSON.stringify(input);
      return request(path, publicStocktakeSchema, {
        method: 'POST',
        body,
        headers: { 'Idempotency-Key': intent.value() },
      });
    },
    onSuccess: () => {
      intent.clear();
      return Promise.all(
        [stocktakeKeys, webListKeys, stockKeys].map((k) => client.invalidateQueries({ queryKey: k._def })),
      );
    },
  });
}
