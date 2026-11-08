import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useRef } from 'react';
import { detailSchema, type Detail } from '@wms/contracts';
import { request } from '../../api/client';
import { outboundKeys } from './keys';
import { stockKeys } from '../stock/keys';
import { webListKeys } from '../web-lists/keys';
export function useConfirm() {
  const client = useQueryClient();
  const pending = useRef<{ input: string; key: string } | null>(null);
  return useMutation({
    mutationFn: (order: Detail) => {
      const body = JSON.stringify({ revision: order.revision, digest: order.digest });
      const input = `${order.id}:${body}`;
      if (pending.current?.input !== input) pending.current = { input, key: crypto.randomUUID() };
      return request(`/outbound/${order.id}/confirm`, detailSchema, {
        method: 'POST',
        headers: { 'Idempotency-Key': pending.current.key },
        body,
      });
    },
    onSuccess: async () => {
      await Promise.all([
        client.invalidateQueries({ queryKey: outboundKeys._def }),
        client.invalidateQueries({ queryKey: stockKeys._def }),
        client.invalidateQueries({ queryKey: webListKeys._def }),
      ]);
    },
  });
}
