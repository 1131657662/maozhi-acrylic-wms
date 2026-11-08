import { useRef } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { lifecyclePreviewSchema, type LifecyclePreview } from '@wms/contracts';
import { request } from '../../api/client';
import { lifecycleKeys } from './keys';
import { inboundKeys } from '../inbound/keys';
import { outboundKeys } from '../outbound/keys';
import { stockKeys } from '../stock/keys';
import { webListKeys } from '../web-lists/keys';

export function useCloseDocument() {
  const client = useQueryClient(),
    pending = useRef<{ body: string; path: string; key: string } | null>(null);
  return useMutation({
    mutationFn: ({ preview, reason }: { preview: LifecyclePreview; reason: string }) => {
      const body = JSON.stringify({ expectedToken: preview.token, reason: reason.trim() });
      const path = `/${preview.kind}/${preview.id}/${preview.action}`;
      if (pending.current?.body !== body || pending.current?.path !== path)
        pending.current = { body, path, key: crypto.randomUUID() };
      return request(path, lifecyclePreviewSchema, {
        method: 'POST',
        body,
        headers: { 'Idempotency-Key': pending.current.key },
      });
    },
    onSuccess: async () => {
      await Promise.all(
        [lifecycleKeys, inboundKeys, outboundKeys, stockKeys, webListKeys].map((keys) =>
          client.invalidateQueries({ queryKey: keys._def }),
        ),
      );
    },
  });
}
