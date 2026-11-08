import { createQueryKeys } from '@lukemorales/query-key-factory';
import { exportJobSchema } from '@wms/contracts';
import { request } from '../../api/client';
export const exportKeys = createQueryKeys('web-exports', {
  job: (id: string) => ({ queryKey: [id], queryFn: () => request(`/web/exports/${id}`, exportJobSchema) }),
  active: { queryKey: null, queryFn: () => request('/web/exports/active', exportJobSchema.nullable()) },
});
