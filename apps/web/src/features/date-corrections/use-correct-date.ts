import { useRef } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  dateCorrectionInputSchema,
  dateCorrectionSchema,
  type CorrectionTarget,
  type DateCorrectionInput,
} from '@wms/contracts';
import { request } from '../../api/client';
import { dateCorrectionKeys } from './keys';
import { inboundKeys } from '../inbound/keys';
import { outboundKeys } from '../outbound/keys';
import { webListKeys } from '../web-lists/keys';
import { auditKeys } from '../audit/keys';

export function useCorrectDate(target: CorrectionTarget) {
  const client = useQueryClient();
  const intent = useRef<{ body: string; key: string } | null>(null);
  return useMutation({
    mutationFn: (input: DateCorrectionInput) => {
      const body = JSON.stringify(dateCorrectionInputSchema.parse(input));
      if (intent.current?.body !== body) intent.current = { body, key: crypto.randomUUID() };
      return request(`/${target.kind}/${target.id}/date-corrections`, dateCorrectionSchema, {
        method: 'POST',
        body,
        headers: { 'Idempotency-Key': intent.current.key },
      });
    },
    onSuccess: async () => {
      intent.current = null;
      await Promise.all(
        [dateCorrectionKeys, inboundKeys, outboundKeys, webListKeys, auditKeys].map((keys) =>
          client.invalidateQueries({ queryKey: keys._def }),
        ),
      );
    },
  });
}
