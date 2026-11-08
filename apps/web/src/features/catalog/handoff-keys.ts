import { createQueryKeys } from '@lukemorales/query-key-factory';
import { handoffOverviewSchema, handoffDetailSchema, detailSchema } from '@wms/contracts';
import { request } from '../../api/client';

export const handoffKeys = createQueryKeys('catalog-handoff', {
  overview: { queryKey: null, queryFn: () => request('/catalog/handoffs', handoffOverviewSchema) },
  detail: (id: string) => ({
    queryKey: [id],
    queryFn: async () => {
      const first = await request(`/catalog/handoffs/${id}`, handoffDetailSchema);
      for (let page = 2; (page - 1) * 100 < first.total; page++) {
        const next = await request(`/catalog/handoffs/${id}?page=${page}`, handoffDetailSchema);
        first.items.push(...next.items);
      }
      return first;
    },
  }),
  plan: (id: string) => ({
    queryKey: [id],
    queryFn: () => request(`/outbound/${encodeURIComponent(id)}`, detailSchema),
  }),
});
