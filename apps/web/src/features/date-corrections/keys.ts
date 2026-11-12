import { createQueryKeys } from '@lukemorales/query-key-factory';
import { dateCorrectionHistorySchema, type CorrectionKind } from '@wms/contracts';
import { request } from '../../api/client';
export const dateCorrectionKeys = createQueryKeys('date-corrections', {
  history: (kind: CorrectionKind, id: string) => ({
    queryKey: [kind, id],
    queryFn: () => request(`/${kind}/${id}/date-corrections`, dateCorrectionHistorySchema),
  }),
});
