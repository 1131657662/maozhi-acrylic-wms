import { createQueryKeys } from '@lukemorales/query-key-factory';
import { masterItemsSchema, type MasterCatalog } from '@wms/contracts';
import { request } from '../../api/client';

export const masterDataKeys = createQueryKeys('masterData', {
  list: (catalog: MasterCatalog) => ({
    queryKey: [catalog],
    queryFn: () => request(`/master-data/${catalog}`, masterItemsSchema),
  }),
});
