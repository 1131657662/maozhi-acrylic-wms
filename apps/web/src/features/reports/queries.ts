import { createQueryKeys } from '@lukemorales/query-key-factory';
import { reportDetailsSchema, reportMonthlySchema } from '@wms/contracts';
import { request } from '../../api/client';
import type { ListParams } from '../web-lists/keys';

export const reportKeys = createQueryKeys('reports', {
  details: (params: ListParams) => ({
    queryKey: [params],
    queryFn: () => request(`/web/reports/details?${new URLSearchParams(params)}`, reportDetailsSchema),
  }),
  monthly: (params: ListParams) => ({
    queryKey: [params],
    queryFn: () => request(`/web/reports/monthly?${new URLSearchParams(params)}`, reportMonthlySchema),
  }),
});
