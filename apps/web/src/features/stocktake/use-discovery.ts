import { useRef } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { discoverySchema, discoveryDeletedSchema, type CreateDiscovery, type UpdateDiscovery } from '@wms/contracts';
import { request } from '../../api/client';
import { stocktakeKeys } from './keys';
import { auditKeys } from '../audit/keys';

type Command =
  | { method: 'POST'; input: CreateDiscovery }
  | { method: 'PATCH'; lineId: string; input: UpdateDiscovery }
  | { method: 'DELETE'; lineId: string; input: { version: number } };
export function useDiscovery(id: string) {
  const client = useQueryClient();
  const pending = useRef<{ signature: string; key: string } | null>(null);
  return useMutation({
    mutationFn: async (command: Command) => {
      const path = `/stocktake/${id}/discoveries${'lineId' in command ? `/${command.lineId}` : ''}`;
      const signature = JSON.stringify(command);
      if (pending.current?.signature !== signature) pending.current = { signature, key: crypto.randomUUID() };
      const options = {
        method: command.method,
        body: JSON.stringify(command.input),
        headers: { 'Idempotency-Key': pending.current.key },
      };
      return command.method === 'DELETE'
        ? request(path, discoveryDeletedSchema, options)
        : request(path, discoverySchema, options);
    },
    onSuccess: () => {
      pending.current = null;
      return Promise.all([stocktakeKeys, auditKeys].map((keys) => client.invalidateQueries({ queryKey: keys._def })));
    },
  });
}
