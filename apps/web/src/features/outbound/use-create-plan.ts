import { useMutation, useQueryClient } from '@tanstack/react-query';
import { createOutboundPlanSchema, detailSchema, type OutboundPlanFields } from '@wms/contracts';
import { request } from '../../api/client';
import { outboundKeys } from './keys';

export function useCreatePlan() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (plan: OutboundPlanFields) =>
      request('/outbound', detailSchema, {
        method: 'POST',
        headers: { 'Idempotency-Key': crypto.randomUUID() },
        body: JSON.stringify(createOutboundPlanSchema.parse(plan)),
      }),
    onSuccess: () => client.invalidateQueries({ queryKey: outboundKeys._def }),
  });
}
