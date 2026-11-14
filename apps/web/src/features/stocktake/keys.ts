import { createQueryKeys } from '@lukemorales/query-key-factory';
import {
  publicStocktakeDetailSchema,
  publicStocktakeListSchema,
  publicStocktakeLinesSchema,
  publicStocktakePreviewSchema,
} from '@wms/contracts';
import { request } from '../../api/client';

export const stocktakeKeys = createQueryKeys('stocktakes', {
  list: (params: Record<string, string>) => ({
    queryKey: [params],
    queryFn: () => request(`/stocktakes?${new URLSearchParams(params)}`, publicStocktakeListSchema),
  }),
  active: {
    queryKey: null,
    queryFn: () => request('/stocktakes?status=counting&pageSize=200', publicStocktakeListSchema),
  },
  detail: (id: string) => ({
    queryKey: [id],
    queryFn: () => request(`/stocktakes/${id}`, publicStocktakeDetailSchema),
  }),
  lines: (id: string, params: Record<string, string>) => ({
    queryKey: [id, params],
    queryFn: () => request(`/stocktakes/${id}/lines?${new URLSearchParams(params)}`, publicStocktakeLinesSchema),
  }),
  preview: (id: string) => ({
    queryKey: [id],
    queryFn: () => request(`/stocktakes/${id}/preview`, publicStocktakePreviewSchema),
  }),
});
