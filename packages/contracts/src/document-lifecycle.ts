import { z } from 'zod';

export const documentKindLifecycleSchema = z.enum(['inbound', 'outbound']);
export type LifecycleKind = z.infer<typeof documentKindLifecycleSchema>;
export const lifecycleActionSchema = z.enum(['reverse', 'void']);
export const lifecycleCommandSchema = z.strictObject({
  reason: z.string().trim().min(1, '必须填写原因').max(500),
  expectedToken: z.string().regex(/^[a-f0-9]{64}$/),
});
export const lifecycleBlockerSchema = z.object({ code: z.string(), message: z.string() });
export const compensationLineSchema = z.object({
  journalId: z.number().int(),
  productCode: z.string(),
  warehouseCode: z.string(),
  packagesDelta: z.number().int(),
  weightDeltaGrams: z.number().int(),
  packagesBefore: z.number().int(),
  weightBeforeGrams: z.number().int(),
  packagesAfter: z.number().int(),
  weightAfterGrams: z.number().int(),
});
export const closureSchema = z.object({
  id: z.uuid(),
  action: lifecycleActionSchema,
  reason: z.string(),
  actor: z.string(),
  createdAt: z.string(),
  originalOperationId: z.uuid().nullable(),
  compensationOperationId: z.uuid().nullable(),
});
export const lifecyclePreviewSchema = z.object({
  kind: documentKindLifecycleSchema,
  id: z.string(),
  number: z.string(),
  status: z.string().nullable(),
  action: lifecycleActionSchema.nullable(),
  allowed: z.boolean(),
  token: z.string(),
  originalOperationId: z.uuid().nullable(),
  lines: z.array(compensationLineSchema),
  blockers: z.array(lifecycleBlockerSchema),
  closure: closureSchema.nullable(),
});
export type LifecyclePreview = z.infer<typeof lifecyclePreviewSchema>;
export type LifecycleCommand = z.infer<typeof lifecycleCommandSchema>;
export type LifecycleAction = z.infer<typeof lifecycleActionSchema>;
export type LifecycleBlocker = z.infer<typeof lifecycleBlockerSchema>;
