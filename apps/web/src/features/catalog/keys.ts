import { createQueryKeys } from '@lukemorales/query-key-factory';
import {
  catalogBarcodeTraceResultSchema,
  catalogHistorySchema,
  catalogDiffPageSchema,
  catalogLookupResultSchema,
  catalogOverviewSchema,
  catalogSearchResultSchema,
  catalogSpecSummaryResultSchema,
  type CatalogSearchQuery,
  CATALOG_DIFF_PAGE_SIZE,
  catalogVersionSchema,
  catalogCandidateHandoffsSchema,
} from '@wms/contracts';
import { request } from '../../api/client';

export const catalogKeys = createQueryKeys('catalog', {
  version: (id: number) => ({
    queryKey: [id],
    queryFn: () => request(`/catalog/versions/${id}`, catalogVersionSchema),
  }),
  handoffs: (id: number, page: number) => ({
    queryKey: [id, page],
    queryFn: () => request(`/catalog/versions/${id}/handoffs?page=${page}`, catalogCandidateHandoffsSchema),
  }),
  overview: { queryKey: null, queryFn: () => request('/catalog', catalogOverviewSchema) },
  search: (query: CatalogSearchQuery) => ({
    queryKey: [query],
    queryFn: () => {
      const params = new URLSearchParams({ q: query.q, page: String(query.page), pageSize: String(query.pageSize) });
      return request(`/catalog/search?${params}`, catalogSearchResultSchema);
    },
  }),
  specSummary: { queryKey: null, queryFn: () => request('/catalog/spec-summary', catalogSpecSummaryResultSchema) },
  trace: (barcode: string) => ({
    queryKey: [barcode],
    queryFn: () => {
      const params = new URLSearchParams({ barcode });
      return request(`/catalog/barcode-trace?${params}`, catalogBarcodeTraceResultSchema);
    },
  }),
  lookup: (barcode: string) => ({
    queryKey: [barcode],
    queryFn: () => {
      const params = new URLSearchParams({ barcode });
      return request(`/catalog/lookup?${params}`, catalogLookupResultSchema);
    },
  }),
  history: (page: number) => ({
    queryKey: [page],
    queryFn: () => request(`/catalog/versions?page=${page}`, catalogHistorySchema),
  }),
  diff: (version: number, kind: string, after: string, against?: number) => ({
    queryKey: [version, kind, after, against],
    queryFn: () =>
      request(
        `/catalog/versions/${version}/diff?kind=${kind}&afterBarcode=${encodeURIComponent(after)}&limit=${CATALOG_DIFF_PAGE_SIZE}${against === undefined ? '' : `&against=${against}`}`,
        catalogDiffPageSchema,
      ),
  }),
});
