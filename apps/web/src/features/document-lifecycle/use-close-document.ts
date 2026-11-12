import { useSubmissionKey } from '../../components/form-protection/use-submission-key';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { lifecyclePreviewSchema, type LifecyclePreview } from '@wms/contracts';
import { request } from '../../api/client';
import { lifecycleKeys } from './keys';
import { inboundKeys } from '../inbound/keys';
import { outboundKeys } from '../outbound/keys';
import { stockKeys } from '../stock/keys';
import { webListKeys } from '../web-lists/keys';
import { dateCorrectionKeys } from '../date-corrections/keys';

export function useCloseDocument() {
  const client = useQueryClient();
  const intent = useSubmissionKey();
  return useMutation({
    mutationFn: ({ preview, reason }: { preview: LifecyclePreview; reason: string }) => {
      const body = JSON.stringify({ expectedToken: preview.token, reason: reason.trim() });
      const path = `/${preview.kind}/${preview.id}/${preview.action}`;
      return request(path, lifecyclePreviewSchema, {
        method: 'POST',
        body,
        headers: { 'Idempotency-Key': intent.value() },
      });
    },
    onSuccess: async () => {
      intent.clear();
      await Promise.all(
        [lifecycleKeys, inboundKeys, outboundKeys, stockKeys, webListKeys, dateCorrectionKeys].map((keys) =>
          client.invalidateQueries({ queryKey: keys._def }),
        ),
      );
    },
  });
}
