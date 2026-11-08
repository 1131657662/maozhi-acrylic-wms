import { z } from 'zod';

export const documentKindSchema = z.enum(['inbound', 'outbound']);
export const numberingUpdateSchema = z.strictObject({
  width: z.number().int().min(2).max(8),
  expectedVersion: z.number().int().nonnegative(),
});
export const numberingRuleSchema = z.object({
  kind: documentKindSchema,
  prefix: z.enum(['RK', 'CK']),
  width: z.number().int().min(2).max(8),
  version: z.number().int().nonnegative(),
  dateKey: z.string().regex(/^\d{8}$/),
  timeZone: z.literal('Asia/Shanghai'),
  preview: z.string().nullable(),
  previewError: z.string().nullable(),
});
export const numberingRulesSchema = z.array(numberingRuleSchema);
export type DocumentKind = z.infer<typeof documentKindSchema>;
export type NumberingRule = z.infer<typeof numberingRuleSchema>;
export type NumberingUpdate = z.infer<typeof numberingUpdateSchema>;
