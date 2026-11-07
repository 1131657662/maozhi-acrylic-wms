import { useMutation, useQueryClient } from '@tanstack/react-query';
import { detailSchema, type OutboundPlanFields } from '@wms/contracts';
import { request } from '../../api/client';
import { outboundKeys } from './keys';

interface UpdatePlanInput {
  id: string;
  revision: number;
  digest: string;
  plan: OutboundPlanFields;
}

export function useUpdatePlan() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({ id, revision, digest, plan }: UpdatePlanInput) =>
      request(`/outbound/${id}`, detailSchema, {
        method: 'PATCH',
        headers: { 'Idempotency-Key': crypto.randomUUID() },
        body: JSON.stringify({ revision, digest, plan }),
      }),
    onSuccess: () => client.invalidateQueries({ queryKey: outboundKeys._def }),
  });
}
