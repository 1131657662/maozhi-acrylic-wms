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
  }),
);
