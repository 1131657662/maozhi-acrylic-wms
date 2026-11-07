import { useMutation, useQueryClient } from '@tanstack/react-query';
import { masterItemSchema, type MasterCatalog } from '@wms/contracts';
import { request } from '../../api/client';
import { masterDataKeys } from './keys';

interface UpdateMasterItemInput {
  catalog: MasterCatalog;
  code: string;
  name?: string;
  active?: boolean;
}

export function useUpdateMasterItem() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({ catalog, code, ...body }: UpdateMasterItemInput) =>
      request(`/master-data/${catalog}/${encodeURIComponent(code)}`, masterItemSchema, {
        method: 'PATCH',
        body: JSON.stringify(body),
      }),
    onSuccess: (_item, input) => client.invalidateQueries({ queryKey: masterDataKeys.list(input.catalog).queryKey }),
  });
}
