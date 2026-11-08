import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useRef } from 'react';
import { createOutboundPlanSchema, detailSchema, type OutboundPlanFields } from '@wms/contracts';
import { request } from '../../api/client';
import { outboundKeys } from './keys';
import { webListKeys } from '../web-lists/keys';

export function useCreatePlan() {
  const client = useQueryClient();
  const pending = useRef<{ body: string; key: string } | null>(null);
  return useMutation({
    mutationFn: (plan: OutboundPlanFields) => {
      const body = JSON.stringify(createOutboundPlanSchema.parse(plan));
      if (pending.current?.body !== body) pending.current = { body, key: crypto.randomUUID() };
      return request('/outbound', detailSchema, {
        method: 'POST',
        headers: { 'Idempotency-Key': pending.current.key }, body,
      });
    },
    onSuccess: () => {
      pending.current = null;
      void client.invalidateQueries({ queryKey: webListKeys._def });
      return client.invalidateQueries({ queryKey: outboundKeys._def });
    },
  });
}
