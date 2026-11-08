import { z } from 'zod';

export const journalQuerySchema = z.object({ limit: z.coerce.number().int().min(1).max(100).default(20) });
export const journalSchema = z.array(
  z.object({
    id: z.string(),
    type: z.string().nullable(),
    warehouseCode: z.string(),
    productCode: z.string(),
    packagesDelta: z.number().int(),
    weightDeltaGrams: z.number().int(),
    createdAt: z.string(),
    before: z.object({ packages: z.number().int(), weightGrams: z.number().int() }).nullable().default(null),
    after: z.object({ packages: z.number().int(), weightGrams: z.number().int() }).nullable().default(null),
    operationId: z.string().nullable().default(null),
    operationType: z.string().nullable().default(null),
    reason: z.string().nullable().default(null),
    evidenceKind: z.enum(['transaction', 'source-snapshot', 'legacy-unrecorded']).default('legacy-unrecorded'),
  }),
);
