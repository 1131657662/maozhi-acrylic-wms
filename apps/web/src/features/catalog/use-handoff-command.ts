import { useMutation, useQueryClient } from '@tanstack/react-query';
import { z } from 'zod';
import { request } from '../../api/client';
import { handoffKeys } from './handoff-keys';
import { catalogKeys } from './keys';

type Command =
  | { id: string; action: 'confirm'; body?: never }
  | { id: string; action: 'clients'; body: { clientKey: string } }
  | { id: string; action: 'bind'; body: { factIds: string[]; outboundLineId: string } };
export function useHandoffCommand() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async (command: Command) => {
      const bodies =
        command.action === 'bind'
          ? Array.from({ length: Math.ceil(command.body.factIds.length / 100) }, (_, i) => ({
              ...command.body,
              factIds: command.body.factIds.slice(i * 100, i * 100 + 100),
            }))
          : [command.body ?? {}];
      for (const body of bodies)
        await request(`/catalog/handoffs/${command.id}/${command.action}`, z.object({}), {
          method: 'POST',
          body: JSON.stringify(body),
        });
    },
    onSettled: async () => {
      await client.invalidateQueries({ queryKey: handoffKeys._def });
      await client.invalidateQueries({ queryKey: catalogKeys.overview.queryKey });
    },
  });
}
