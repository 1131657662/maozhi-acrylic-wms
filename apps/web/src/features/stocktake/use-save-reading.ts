import { useSubmissionKey } from '../../components/form-protection/use-submission-key';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { publicStocktakeLineSchema, type SaveReading } from '@wms/contracts';
import { request } from '../../api/client';
import { stocktakeKeys } from './keys';

export function useSaveReading() {
  const client = useQueryClient();
  const intent = useSubmissionKey();
  return useMutation({
    mutationFn: ({ id, productCode, input }: { id: string; productCode: string; input: SaveReading }) => {
      const body = JSON.stringify(input),
        path = `/stocktakes/${id}/lines/${encodeURIComponent(productCode)}`;
      return request(path, publicStocktakeLineSchema, {
        method: 'PUT',
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
