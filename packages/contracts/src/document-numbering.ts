import { z } from 'zod';
import { DOCUMENT_NUMBER_WIDTH } from './numbering-policy.ts';

export const documentKindSchema = z.enum(['inbound', 'outbound', 'correction']);
export const numberingUpdateSchema = z.strictObject({
  width: z.literal(DOCUMENT_NUMBER_WIDTH),
  expectedVersion: z.number().int().nonnegative(),
});
export const numberingRuleSchema = z.object({
  kind: documentKindSchema,
  prefix: z.enum(['RK', 'CK', 'GZ']),
  width: z.literal(DOCUMENT_NUMBER_WIDTH),
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
