import { useSubmissionKey } from '../../components/form-protection/use-submission-key';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { masterItemSchema, type MasterCatalog, type CreateMasterItem } from '@wms/contracts';
import { request } from '../../api/client';
import { masterDataKeys } from './keys';

interface CreateMasterItemInput extends CreateMasterItem {
  catalog: MasterCatalog;
  name: string;
}

export function useCreateMasterItem() {
  const client = useQueryClient();
  const intent = useSubmissionKey();
  return useMutation({
    mutationFn: ({ catalog, ...body }: CreateMasterItemInput) => {
      return request(`/master/${catalog}`, masterItemSchema, {
        method: 'POST',
        body: JSON.stringify(body),
        headers: { 'Idempotency-Key': intent.value() },
      });
    },
    onSuccess: () => {
      intent.clear();
      return client.invalidateQueries({ queryKey: masterDataKeys._def });
    },
  });
}
