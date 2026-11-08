import { createQueryKeys } from '@lukemorales/query-key-factory';
import { stocktakeSchema, stocktakeListSchema, stocktakeLinesSchema, stocktakePreviewSchema } from '@wms/contracts';
import { request } from '../../api/client';

export const stocktakeKeys = createQueryKeys('stocktakes', {
  list: (params: Record<string, string>) => ({
    queryKey: [params],
    queryFn: () => request(`/stocktakes?${new URLSearchParams(params)}`, stocktakeListSchema),
  }),
  active: { queryKey: null, queryFn: () => request('/stocktakes?status=counting&pageSize=200', stocktakeListSchema) },
  detail: (id: string) => ({ queryKey: [id], queryFn: () => request(`/stocktakes/${id}`, stocktakeSchema) }),
  lines: (id: string, params: Record<string, string>) => ({
    queryKey: [id, params],
    queryFn: () => request(`/stocktakes/${id}/lines?${new URLSearchParams(params)}`, stocktakeLinesSchema),
  }),
  preview: (id: string) => ({
    queryKey: [id],
    queryFn: () => request(`/stocktakes/${id}/preview`, stocktakePreviewSchema),
  }),
});
