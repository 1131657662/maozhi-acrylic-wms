import { useRef } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { correctionInputSchema, correctionSchema, type CorrectionInput, type CorrectionTarget } from '@wms/contracts';
import { request } from '../../api/client';
import { correctionKeys } from './keys';
import { lifecycleKeys } from '../document-lifecycle/keys';
import { inboundKeys } from '../inbound/keys';
import { outboundKeys } from '../outbound/keys';
import { stockKeys } from '../stock/keys';
import { webListKeys } from '../web-lists/keys';

export function useCorrect(target: CorrectionTarget) {
  const client = useQueryClient();
  const pending = useRef<{ body: string; key: string } | null>(null);
  return useMutation({
    mutationFn: (input: CorrectionInput) => {
      const body = JSON.stringify(correctionInputSchema.parse(input));
      if (pending.current?.body !== body) pending.current = { body, key: crypto.randomUUID() };
      return request(`/${target.kind}/${target.id}/corrections`, correctionSchema, {
        method: 'POST',
        body,
        headers: { 'Idempotency-Key': pending.current.key },
      });
    },
    onSuccess: async () => {
      pending.current = null;
      await Promise.all(
        [correctionKeys, lifecycleKeys, inboundKeys, outboundKeys, stockKeys, webListKeys].map((keys) =>
          client.invalidateQueries({ queryKey: keys._def }),
        ),
      );
    },
  });
}
