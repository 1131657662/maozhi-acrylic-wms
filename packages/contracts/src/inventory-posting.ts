import { z } from 'zod';

const code = z.string().min(1).max(80);
const grams = z.number().int().safe().min(-99_999_999_999_900).max(99_999_999_999_900).multipleOf(100);
export const stockBalanceSchema = z.object({
  packages: z.number().int().min(0).max(2_147_483_647),
  weightGrams: grams.refine((value) => value >= 0),
});
export const confirmInboundSchema = z.strictObject({});
export const stockAdjustmentSchema = z
  .strictObject({
    warehouseCode: code,
    productCode: code,
    packagesDelta: z.number().int().min(-2_147_483_647).max(2_147_483_647),
    weightDeltaGrams: grams,
    expected: stockBalanceSchema.strict(),
    reason: z.string().trim().min(1, '调整原因必填').max(500),
  })
  .refine((value) => value.packagesDelta !== 0 || value.weightDeltaGrams !== 0, '调整量不能同时为零');
export const stockAdjustmentResultSchema = z.object({
  operationId: z.uuid(),
  operationType: z.literal('stock.adjust'),
  warehouseCode: code,
  productCode: code,
  reason: z.string(),
  before: stockBalanceSchema,
  after: stockBalanceSchema,
});
export type StockBalance = z.infer<typeof stockBalanceSchema>;
export type StockAdjustment = z.infer<typeof stockAdjustmentSchema>;
export type StockAdjustmentResult = z.infer<typeof stockAdjustmentResultSchema>;
