import { useSubmissionKey } from '../../components/form-protection/use-submission-key';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { publicStocktakeSchema, type CreateStocktake } from '@wms/contracts';
import { request } from '../../api/client';
import { stocktakeKeys } from './keys';

export function useCreateStocktake() {
  const client = useQueryClient();
  const intent = useSubmissionKey();
  return useMutation({
    mutationFn: (input: CreateStocktake) => {
      const body = JSON.stringify(input);
      return request('/stocktakes', publicStocktakeSchema, {
        method: 'POST',
        body,
        headers: { 'Idempotency-Key': intent.value() },
      });
    },
    onSuccess: () => {
      intent.clear();
      return client.invalidateQueries({ queryKey: stocktakeKeys._def });
    },
  });
}
