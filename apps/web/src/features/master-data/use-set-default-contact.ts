import { useMutation, useQueryClient } from '@tanstack/react-query';
import { contactSchema } from '@wms/contracts';
import { request } from '../../api/client';
import { contactKeys } from './contact-keys';
import { masterDataKeys } from './keys';

export function useSetDefaultContact() {
  const client = useQueryClient();
  const write: (input: string) => Promise<unknown> = (id) =>
    request(`/master/contacts/${id}/default`, contactSchema, { method: 'PUT', body: '{}' });
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
