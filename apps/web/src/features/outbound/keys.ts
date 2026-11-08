import { createQueryKeys } from '@lukemorales/query-key-factory';
import { detailSchema, listSchema, auditSchema } from '@wms/contracts';
import { request } from '../../api/client';
export interface Filters {
  page: number;
  pageSize: number;
  keyword: string;
  status: string;
}
export const outboundKeys = createQueryKeys('outbound', {
  list: (filters: Filters) => ({
    queryKey: [filters],
    queryFn: () => {
      const query = new URLSearchParams({
        page: String(filters.page),
        pageSize: String(filters.pageSize),
        keyword: filters.keyword,
      });
      if (filters.status) query.set('status', filters.status);
      return request(`/outbound?${query}`, listSchema);
    },
  }),
  detail: (id: string) => ({ queryKey: [id], queryFn: () => request(`/outbound/${id}`, detailSchema) }),
  audit: { queryKey: null, queryFn: () => request('/audit', auditSchema) },
});
