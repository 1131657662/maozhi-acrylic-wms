import { z } from 'zod';
import { stockBalanceSchema } from './inventory-posting.ts';

const code = z.string().min(1).max(80);
const status = z.enum(['counting', 'completed', 'voided']);
export const stocktakeModeSchema = z.enum(['open', 'blind']);
export const createStocktakeSchema = z.strictObject({
  warehouseCode: code,
  mode: stocktakeModeSchema.default('open'),
  productCodes: z
    .array(code)
    .min(1)
    .max(100)
    .refine((v) => new Set(v).size === v.length, '商品不能重复')
    .optional(),
});
export const stocktakeSchema = z.object({
  id: z.uuid(),
  number: z.string(),
  warehouseCode: code,
  warehouseName: z.string(),
  scope: z.enum(['warehouse', 'products']),
  mode: stocktakeModeSchema.default('open'),
  revealedAt: z.string().nullable().default(null),
  status,
  snapshotAt: z.string(),
  snapshotHash: z.string(),
  revision: z.number().int(),
  lineCount: z.number().int(),
  recordedCount: z.number().int(),
  changedCount: z.number().int(),
  createdBy: z.string(),
  closedAt: z.string().nullable(),
  closeReason: z.string().nullable(),
  operationId: z.string().nullable(),
  snapshotPackages: z.number().int().safe(),
  snapshotWeightGrams: z.number().int().safe(),
  actualPackages: z.number().int().safe(),
  actualWeightGrams: z.number().int().safe(),
  packagesDelta: z.number().int().safe(),
  weightDeltaGrams: z.number().int().safe(),
});
export const stocktakeLineSchema = z.object({
  productCode: code,
  productName: z.string(),
  snapshot: stockBalanceSchema,
  actual: stockBalanceSchema.nullable(),
  revision: z.number().int(),
  packagesDelta: z.number().int().nullable(),
  weightDeltaGrams: z.number().int().nullable(),
});
export const stocktakeQuerySchema = z.object({
  page: z.coerce.number().int().min(1).max(100000).default(1),
  pageSize: z.coerce.number().int().min(1).max(200).default(20),
  keyword: z.string().trim().max(80).default(''),
  status: status.optional(),
  warehouseCode: code.optional(),
});
export const stocktakeListSchema = z.object({ items: z.array(stocktakeSchema), total: z.number().int() });
export const stocktakeLinesSchema = z.object({ items: z.array(stocktakeLineSchema), total: z.number().int() });
export const saveReadingSchema = z.strictObject({
  expectedRevision: z.number().int().nonnegative(),
  actual: stockBalanceSchema.strict(),
});
export const unpostedDocumentSchema = z.object({
  kind: z.enum(['inbound', 'outbound']),
  id: z.string(),
  number: z.string(),
  status: z.string(),
  packages: z.number().int(),
  weightGrams: z.number().int(),
  scannedPackages: z.number().int().nullable(),
  scannedWeightGrams: z.number().int().nullable(),
  revision: z.number().int(),
});
export const stocktakePreviewSchema = z.object({
  stocktake: stocktakeSchema,
  token: z.string(),
  unposted: z.array(unpostedDocumentSchema),
  blockers: z.array(z.object({ code: z.string(), message: z.string() })),
});
export const stocktakePostSchema = z.strictObject({
  expectedToken: z.string().length(64),
  reason: z.string().trim().min(1, '回写原因必填').max(500),
  acknowledgeSnapshotBasis: z.boolean().default(false),
});
export const voidStocktakeSchema = z.strictObject({
  expectedRevision: z.number().int().nonnegative(),
  reason: z.string().trim().min(1, '作废原因必填').max(500),
});
export type Stocktake = z.infer<typeof stocktakeSchema>;
export type StocktakeLine = z.infer<typeof stocktakeLineSchema>;
export type StocktakePreview = z.infer<typeof stocktakePreviewSchema>;
export type CreateStocktake = z.input<typeof createStocktakeSchema>;
export type SaveReading = z.infer<typeof saveReadingSchema>;
export type StocktakePost = z.infer<typeof stocktakePostSchema>;
export type StocktakeQuery = z.infer<typeof stocktakeQuerySchema>;
