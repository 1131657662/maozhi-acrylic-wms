import { useMutation, useQueryClient } from '@tanstack/react-query';
import { masterItemSchema, type MasterCatalog, type CreateMasterItem } from '@wms/contracts';
import { request } from '../../api/client';
import { masterDataKeys } from './keys';

interface CreateMasterItemInput extends CreateMasterItem {
  catalog: MasterCatalog;
  code: string;
  name: string;
}

export function useCreateMasterItem() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({ catalog, ...body }: CreateMasterItemInput) =>
      request(`/master/${catalog}`, masterItemSchema, { method: 'POST', body: JSON.stringify(body) }),
    onSuccess: () => client.invalidateQueries({ queryKey: masterDataKeys._def }),
  });
}
