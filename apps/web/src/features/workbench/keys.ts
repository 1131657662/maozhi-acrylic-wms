import { createQueryKeys } from '@lukemorales/query-key-factory';
import { workbenchSchema } from '@wms/contracts';
import { request } from '../../api/client';

export const workbenchKeys = createQueryKeys('workbench', {
  dashboard: { queryKey: null, queryFn: () => request('/web/dashboard', workbenchSchema) },
});
