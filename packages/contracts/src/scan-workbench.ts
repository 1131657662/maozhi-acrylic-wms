import { z } from 'zod';

export const SCAN_CANDIDATE_PAGE_SIZE = 20;
export const SCAN_BATCH_LIMIT = 200;
export const SCAN_FRAGMENT_MIN = 4;
export const scanSourceLabels = { scanner: '扫码枪', search: '候选选择', paste: '批量粘贴', manual: '手工输入' };
export const scanAttributionLabels = { catalog: '目录对应', manual: '归属人工确认' };
export const scanSourceSchema = z.enum(['scanner', 'search', 'paste', 'manual']);
export const scanAttributionSchema = z.enum(['catalog', 'manual']);
const code = z
  .string()
  .trim()
  .min(1)
  .max(64)
  .regex(/^[a-zA-Z0-9_-]+$/);
export const scanRecordInputSchema = z.strictObject({ barcode: code, productCode: code, source: scanSourceSchema });
export const scanBatchInputSchema = z.strictObject({
  records: z
    .array(z.strictObject({ barcode: z.string().trim().min(1).max(64), productCode: code }))
    .min(1)
    .max(SCAN_BATCH_LIMIT),
  source: z.literal('paste'),
});
export const scanCandidateQuerySchema = z.strictObject({
  query: z.string().trim().min(1).max(64),
  productCode: code,
  page: z.coerce.number().int().min(1).max(10000).default(1),
});
export const scanCandidateSchema = z.object({
  barcode: z.string(),
  sourceSpec: z.string().nullable(),
  weightGrams: z.number().int(),
  status: z.enum(['available', 'recorded', 'revoked']),
  attribution: scanAttributionSchema,
});
export const scanCandidatesSchema = z.object({
  items: z.array(scanCandidateSchema),
  total: z.number().int(),
  page: z.number().int(),
  pageSize: z.number().int(),
});
export const scanRecordResultSchema = z.object({
  barcode: z.string(),
  productCode: z.string(),
  ok: z.boolean(),
  reason: z.string(),
  recordId: z.string().optional(),
  attribution: scanAttributionSchema.optional(),
});
export const scanBatchResultSchema = z.object({ items: z.array(scanRecordResultSchema) });
const quantity = z.object({ packages: z.number().int(), weightGrams: z.number().int() });
const totals = z.object({ planned: quantity, recorded: quantity, difference: quantity });
export const scanSummarySchema = totals.extend({
  products: z.array(totals.extend({ productCode: z.string(), productName: z.string() })),
});
export type ScanRecordInput = z.infer<typeof scanRecordInputSchema>;
export type ScanBatchInput = z.infer<typeof scanBatchInputSchema>;
export type ScanCandidateQuery = z.infer<typeof scanCandidateQuerySchema>;
export type ScanRecordResult = z.infer<typeof scanRecordResultSchema>;
export type ScanSummary = z.infer<typeof scanSummarySchema>;
