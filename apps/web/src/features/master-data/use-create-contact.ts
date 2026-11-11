import { useMutation, useQueryClient } from '@tanstack/react-query';
import { contactSchema } from '@wms/contracts';
import { request } from '../../api/client';
import { contactKeys } from './contact-keys';
import { masterDataKeys } from './keys';
import type { z } from 'zod';
import { createContactSchema } from '@wms/contracts';
import { useSubmissionKey } from '../../components/form-protection/use-submission-key';
export function useCreateContact() {
  const client = useQueryClient();
  const intent = useSubmissionKey();
  const write: (input: z.infer<typeof createContactSchema>) => Promise<unknown> = (input) =>
    request('/master/contacts', contactSchema, {
      method: 'POST',
      body: JSON.stringify(input),
      headers: { 'Idempotency-Key': intent.value() },
    });
  return useMutation({
    mutationFn: write,
    onSuccess: async () => {
      intent.clear();
      await Promise.all([
        client.invalidateQueries({ queryKey: contactKeys._def }),
        client.invalidateQueries({ queryKey: masterDataKeys._def }),
      ]);
    },
  });
}
