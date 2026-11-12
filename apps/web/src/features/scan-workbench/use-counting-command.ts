import { useRef } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { z } from 'zod';
import {
  scanRecordResultSchema,
  scanBatchResultSchema,
  type ScanRecordInput,
  type ScanBatchInput,
} from '@wms/contracts';
import { request } from '../../api/client';
import { useSubmitLock } from '../../components/form-protection/use-submit-lock';
import { outboundKeys } from '../outbound/keys';
import { countingKeys } from './keys';
import { auditKeys } from '../audit/keys';

type Command =
  | { kind: 'record'; input: ScanRecordInput }
  | { kind: 'batch'; input: ScanBatchInput }
  | { kind: 'revoke'; recordId: string };
export function useCountingCommand(id: string) {
  const client = useQueryClient();
  const keys = useRef(new Map<string, string>());
  const lock = useSubmitLock();
  const mutation = useMutation({
    mutationFn: async (command: Command) => {
      const signature = JSON.stringify(command);
      const key = keys.current.get(signature) ?? crypto.randomUUID();
      keys.current.set(signature, key);
      const headers = { 'Idempotency-Key': key };
      const base = `/outbound/${id}/scan-records`;
      if (command.kind === 'revoke') {
        await request(`${base}/${command.recordId}`, z.object({ revoked: z.literal(true) }), {
          method: 'DELETE',
          headers,
        });
        return { items: [] };
      }
      const options = { method: 'POST', headers, body: JSON.stringify(command.input) };
      if (command.kind === 'batch') return request(`${base}/batch`, scanBatchResultSchema, options);
      return { items: [await request(base, scanRecordResultSchema, options)] };
    },
    onSuccess: async (_, command) => {
      keys.current.delete(JSON.stringify(command));
      await Promise.all(
        [outboundKeys._def, countingKeys._def, auditKeys._def].map((queryKey) =>
          client.invalidateQueries({ queryKey }),
        ),
      );
    },
  });
  return {
    run: (command: Command) => lock.run(() => mutation.mutateAsync(command)),
    busy: lock.busy,
    error: mutation.error,
  };
}
export type CountingCommand = ReturnType<typeof useCountingCommand>;
