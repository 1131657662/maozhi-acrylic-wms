import { useMutation, useQueryClient } from '@tanstack/react-query';
import { masterItemSchema, type MasterCatalog } from '@wms/contracts';
import { request } from '../../api/client';
import { masterDataKeys } from './keys';

interface CreateMasterItemInput {
  catalog: MasterCatalog;
  code: string;
  name: string;
}

export function useCreateMasterItem() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({ catalog, ...body }: CreateMasterItemInput) =>
      request(`/master-data/${catalog}`, masterItemSchema, { method: 'POST', body: JSON.stringify(body) }),
    onSuccess: (_item, input) => client.invalidateQueries({ queryKey: masterDataKeys.list(input.catalog).queryKey }),
  });
}
