import { useSubmissionKey } from '../../components/form-protection/use-submission-key';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { createOutboundPlanSchema, detailSchema, type OutboundPlanFields } from '@wms/contracts';
import { request } from '../../api/client';
import { outboundKeys } from './keys';
import { webListKeys } from '../web-lists/keys';

export function useCreatePlan() {
  const client = useQueryClient();
  const intent = useSubmissionKey();
  return useMutation({
    mutationFn: (plan: OutboundPlanFields) => {
      const body = JSON.stringify(createOutboundPlanSchema.parse(plan));
      return request('/outbound', detailSchema, {
        method: 'POST',
        headers: { 'Idempotency-Key': intent.value() },
        body,
      });
    },
    onSuccess: () => {
      intent.clear();
      void client.invalidateQueries({ queryKey: webListKeys._def });
      return client.invalidateQueries({ queryKey: outboundKeys._def });
    },
  });
}
