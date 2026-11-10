import { useMutation, useQueryClient } from '@tanstack/react-query';
import { batchReverseResponseSchema, type BatchReverseCommand, type BatchReverseResponse } from '@wms/contracts';
import { request } from '../../api/client';
import { lifecycleKeys } from './keys';
import { inboundKeys } from '../inbound/keys';
import { outboundKeys } from '../outbound/keys';
import { stockKeys } from '../stock/keys';
import { webListKeys } from '../web-lists/keys';

export function useBatchReverse() {
  const client = useQueryClient();
  return useMutation<BatchReverseResponse, Error, BatchReverseCommand>({
    mutationFn: (input) =>
      request('/web/lifecycle/batch-reverse', batchReverseResponseSchema, {
        method: 'POST',
        body: JSON.stringify(input),
      }),
    onSuccess: async () => {
      await Promise.all(
        [lifecycleKeys, inboundKeys, outboundKeys, stockKeys, webListKeys].map((keys) =>
          client.invalidateQueries({ queryKey: keys._def }),
        ),
      );
    },
  });
}
