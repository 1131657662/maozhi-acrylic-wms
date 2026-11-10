import { useMutation, useQueryClient } from '@tanstack/react-query';
import { contactSchema } from '@wms/contracts';
import { request } from '../../api/client';
import { contactKeys } from './contact-keys';
import { masterDataKeys } from './keys';
import type { z } from 'zod';
import { createContactSchema } from '@wms/contracts';
export function useCreateContact() {
  const client = useQueryClient();
  const write: (input: z.infer<typeof createContactSchema>) => Promise<unknown> = (input) =>
    request('/master/contacts', contactSchema, { method: 'POST', body: JSON.stringify(input) });
  return useMutation({
    mutationFn: write,
    onSuccess: async () => {
      await Promise.all([
        client.invalidateQueries({ queryKey: contactKeys._def }),
        client.invalidateQueries({ queryKey: masterDataKeys._def }),
      ]);
    },
  });
}
