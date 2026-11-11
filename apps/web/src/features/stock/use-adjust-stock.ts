import { useSubmissionKey } from '../../components/form-protection/use-submission-key';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { stockAdjustmentSchema, stockAdjustmentResultSchema, type StockAdjustment } from '@wms/contracts';
import { request } from '../../api/client';
import { stockKeys } from './keys';
import { webListKeys } from '../web-lists/keys';

export function useAdjustStock() {
  const client = useQueryClient();
  const intent = useSubmissionKey();
  return useMutation({
    mutationFn: (input: StockAdjustment) => {
      const body = JSON.stringify(stockAdjustmentSchema.parse(input));
      return request('/stock/adjustments', stockAdjustmentResultSchema, {
        method: 'POST',
        headers: { 'Idempotency-Key': intent.value() },
        body,
      });
    },
    onSuccess: async () => {
      intent.clear();
      await client.invalidateQueries({ queryKey: stockKeys._def });
      await client.invalidateQueries({ queryKey: webListKeys._def });
    },
  });
}
