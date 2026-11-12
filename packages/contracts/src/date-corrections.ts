import { z } from 'zod';
import { businessDateSchema } from './business-date.ts';
import { correctionKindSchema } from './corrections.ts';

export const DATE_CORRECTION_REASON_MAX = 500;
export const correctionDocumentIdSchema = z
  .string()
  .min(1)
  .max(80)
  .regex(/^[a-zA-Z0-9_-]+$/);
export const dateCorrectionInputSchema = z.strictObject({
  afterDate: businessDateSchema,
  reason: z.string().trim().min(1).max(DATE_CORRECTION_REASON_MAX),
  expectedRevision: z.number().int().nonnegative().max(4_294_967_294),
  backdateConfirmed: z.boolean().optional(),
});
export const dateCorrectionSchema = z.strictObject({
  id: z.uuid(),
  documentKind: correctionKindSchema,
  documentId: correctionDocumentIdSchema,
  previousCorrectionId: z.uuid().nullable(),
  beforeDate: businessDateSchema,
  afterDate: businessDateSchema,
  reason: z.string(),
  actor: z.string(),
  operationId: z.uuid(),
  createdAt: z.string(),
  revision: z.number().int().positive(),
});
export const dateCorrectionHistorySchema = z.strictObject({
  businessDate: businessDateSchema.nullable(),
  effectiveBusinessDate: businessDateSchema.nullable(),
  revision: z.number().int().nonnegative(),
  allowed: z.boolean(),
  blockedReason: z.string().nullable(),
  records: z.array(dateCorrectionSchema),
});
export type DateCorrectionInput = z.infer<typeof dateCorrectionInputSchema>;
export type DateCorrection = z.infer<typeof dateCorrectionSchema>;
export type DateCorrectionHistory = z.infer<typeof dateCorrectionHistorySchema>;
