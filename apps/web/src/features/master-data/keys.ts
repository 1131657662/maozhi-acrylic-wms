import { createQueryKeys } from '@lukemorales/query-key-factory';
import { masterPageSchema, masterItemSchema, type MasterCatalog, type MasterListQuery } from '@wms/contracts';
import { request } from '../../api/client';

export const masterDataKeys = createQueryKeys('masterData', {
  list: (catalog: MasterCatalog, query: Partial<MasterListQuery> = {}) => ({
    queryKey: [catalog, query],
    // Existing management callers still pass keyword; autocomplete passes q.
    queryFn: ({ signal }) =>
      request(
        `/master/${catalog}?${new URLSearchParams(Object.entries(query).map(([key, value]) => [key, String(value)]))}`,
        masterPageSchema,
        { signal },
      ),
  }),
  detail: (catalog: MasterCatalog, code: string) => ({
    queryKey: [catalog, code],
    queryFn: () => request(`/master/${catalog}/${encodeURIComponent(code)}`, masterItemSchema),
  }),
});
