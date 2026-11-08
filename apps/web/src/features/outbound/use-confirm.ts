import { useMutation, useQueryClient } from '@tanstack/react-query';
import { detailSchema, type Detail } from '@wms/contracts';
import { request } from '../../api/client';
import { outboundKeys } from './keys';
import { stockKeys } from '../stock/keys';
export function useConfirm() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (order: Detail) =>
      request(`/outbound/${order.id}/confirm`, detailSchema, {
        method: 'POST',
        headers: { 'Idempotency-Key': crypto.randomUUID() },
        body: JSON.stringify({ revision: order.revision, digest: order.digest }),
      }),
    onSuccess: async () => {
      await Promise.all([
        client.invalidateQueries({ queryKey: outboundKeys._def }),
        client.invalidateQueries({ queryKey: stockKeys._def }),
      ]);
    },
  });
}
