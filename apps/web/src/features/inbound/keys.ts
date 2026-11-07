import { createQueryKeys } from '@lukemorales/query-key-factory';
import { inboundListSchema, inboundReceiptSchema } from '@wms/contracts';
import { request } from '../../api/client';

export interface InboundFilters {
  page: number;
  pageSize: number;
  keyword: string;
}

export const inboundKeys = createQueryKeys('inbound', {
  list: (filters: InboundFilters) => ({
    queryKey: [filters],
    queryFn: () => {
      const query = new URLSearchParams({
        page: String(filters.page),
        pageSize: String(filters.pageSize),
        keyword: filters.keyword,
      });
      return request(`/inbound?${query}`, inboundListSchema);
    },
  }),
  detail: (id: string) => ({ queryKey: [id], queryFn: () => request(`/inbound/${id}`, inboundReceiptSchema) }),
});
