import { createQueryKeys } from '@lukemorales/query-key-factory';
import { loadWorkbench } from './load';

export const workbenchKeys = createQueryKeys('workbench', {
  dashboard: { queryKey: null, queryFn: loadWorkbench },
});
