import { createQueryKeys } from '@lukemorales/query-key-factory';
import { z } from 'zod';
import { correctionSummarySchema, type CorrectionKind } from '@wms/contracts';
import { request } from '../../api/client';

export const correctionKeys = createQueryKeys('corrections', {
  detail: (kind: CorrectionKind, id: string) => ({
    queryKey: [kind, id],
    queryFn: () => request(`/${kind}/${id}`, z.object({ corrections: correctionSummarySchema.nullable() })),
  }),
});
