import { z } from 'zod';

export const scanContextInputSchema = z.strictObject({
  outboundLineId: z.string().min(1).max(64),
  sourceSpec: z.string().max(255).nullable(),
  resolvedAt: z.iso.datetime().nullable(),
});
export type ScanContextInput = z.infer<typeof scanContextInputSchema>;
export const factContextPageSchema = z.object({
  items: z.array(
    z.object({
      factId: z.string(),
      outboundLineId: z.string(),
      productCode: z.string(),
      catalogVersion: z.number().int(),
      sourceSpec: z.string().nullable(),
      weightGrams: z.number().int(),
      notice: z.string().nullable(),
    }),
  ),
  nextFactId: z.string().nullable(),
});
