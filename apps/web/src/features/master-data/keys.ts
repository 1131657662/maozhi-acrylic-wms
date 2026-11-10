import { createQueryKeys } from '@lukemorales/query-key-factory';
import { masterPageSchema, masterItemSchema, type MasterCatalog, type MasterListQuery } from '@wms/contracts';
import { request } from '../../api/client';

export const masterDataKeys = createQueryKeys('masterData', {
  list: (catalog: MasterCatalog, query: Partial<MasterListQuery> = {}) => ({
    queryKey: [catalog, query],
    queryFn: () =>
      request(
        `/master/${catalog}?${new URLSearchParams(Object.entries(query).map(([key, value]) => [key, String(value)]))}`,
        masterPageSchema,
      ),
  }),
  detail: (catalog: MasterCatalog, code: string) => ({
    queryKey: [catalog, code],
    queryFn: () => request(`/master/${catalog}/${encodeURIComponent(code)}`, masterItemSchema),
  }),
});
