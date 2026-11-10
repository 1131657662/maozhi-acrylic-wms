import { useMutation, useQueryClient } from '@tanstack/react-query';
import { masterItemSchema, type MasterCatalog, type UpdateMasterItem } from '@wms/contracts';
import { request } from '../../api/client';
import { masterDataKeys } from './keys';

interface UpdateMasterItemInput extends UpdateMasterItem {
  catalog: MasterCatalog;
  code: string;
  name?: string;
  active?: boolean;
}

export function useUpdateMasterItem() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({ catalog, code, ...body }: UpdateMasterItemInput) =>
      request(`/master/${catalog}/${encodeURIComponent(code)}`, masterItemSchema, {
        method: 'PATCH',
        body: JSON.stringify(body),
      }),
    onSuccess: () => client.invalidateQueries({ queryKey: masterDataKeys._def }),
  });
}
