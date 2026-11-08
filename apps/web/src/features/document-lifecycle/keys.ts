import { createQueryKeys } from '@lukemorales/query-key-factory';
import { lifecyclePreviewSchema, type LifecycleKind } from '@wms/contracts';
import { request } from '../../api/client';

export const lifecycleKeys = createQueryKeys('document-lifecycle', {
  detail: (kind: LifecycleKind, id: string) => ({
    queryKey: [kind, id],
    queryFn: () => request(`/${kind}/${id}/lifecycle`, lifecyclePreviewSchema),
  }),
});
