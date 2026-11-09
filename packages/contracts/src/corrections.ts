import { z } from 'zod';

export const correctionKindSchema = z.enum(['inbound', 'outbound']);
const quantity = z.object({ packages: z.number().int(), weightGrams: z.number().int() });
export const correctionInputSchema = z.strictObject({
  expectedCorrectionRevision: z.number().int().nonnegative(),
  previousCorrectionId: z.uuid().nullable(),
  reason: z.string().trim().min(1).max(500),
  lines: z
    .array(
      z.strictObject({
        originalLineId: z.string().min(1).max(80),
        packages: z.number().int().min(0).max(1_000_000),
        weightGrams: z.number().int().min(0).max(99_999_999_999_900).multipleOf(100),
      }),
    )
    .min(1)
    .max(50)
    .refine((lines) => new Set(lines.map((l) => l.originalLineId)).size === lines.length, '原单明细不能重复'),
});
export const correctionLineSchema = z.object({
  originalLineId: z.string(),
  productCode: z.string(),
  before: quantity,
  after: quantity,
  delta: quantity,
});
export const correctionSchema = z.object({
  id: z.uuid(),
  number: z.string(),
  kind: correctionKindSchema,
  originalId: z.string(),
  previousCorrectionId: z.uuid().nullable(),
  revision: z.number().int(),
  reason: z.string(),
  actor: z.string(),
  createdAt: z.string(),
  operationId: z.uuid(),
  offsetOperationId: z.uuid().nullable(),
  lines: z.array(correctionLineSchema),
});
export const correctionSummarySchema = z.object({
  revision: z.number().int(),
  allowed: z.boolean(),
  offset: z.boolean(),
  original: quantity,
  effective: quantity,
  delta: quantity,
  latest: z.object({ id: z.uuid(), number: z.string(), createdAt: z.string() }).nullable(),
  lines: z.array(
    z.object({
      originalLineId: z.string(),
      productCode: z.string(),
      productName: z.string(),
      original: quantity,
      effective: quantity,
      delta: quantity,
    }),
  ),
  records: z.array(correctionSchema),
});
export type CorrectionKind = z.infer<typeof correctionKindSchema>;
export type CorrectionInput = z.infer<typeof correctionInputSchema>;
export type Correction = z.infer<typeof correctionSchema>;
export type CorrectionSummary = z.infer<typeof correctionSummarySchema>;
export interface CorrectionTarget {
  kind: CorrectionKind;
  id: string;
}
