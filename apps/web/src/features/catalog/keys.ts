import { createQueryKeys } from '@lukemorales/query-key-factory';
import { catalogOverviewSchema, catalogHistorySchema, catalogDiffPageSchema } from '@wms/contracts';
import { request } from '../../api/client';

export const catalogKeys = createQueryKeys('catalog', {
  overview: { queryKey: null, queryFn: () => request('/catalog', catalogOverviewSchema) },
  history: (page: number) => ({
    queryKey: [page],
    queryFn: () => request(`/catalog/versions?page=${page}`, catalogHistorySchema),
  }),
  diff: (version: number, kind: string, after: string) => ({
    queryKey: [version, kind, after],
    queryFn: () =>
      request(
        `/catalog/versions/${version}/diff?kind=${kind}&afterBarcode=${encodeURIComponent(after)}&limit=50`,
        catalogDiffPageSchema,
      ),
  }),
});
