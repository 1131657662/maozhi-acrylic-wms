import { z } from 'zod';

const codeSchema = z.string().min(1).max(64).regex(/^[a-zA-Z0-9_-]+$/);
const gramsSchema = z.number().int().positive().max(99_999_999_999_900).multipleOf(100);
export const outboundPlanFieldsSchema = z.strictObject({
  orderNo: z.string().trim().min(1).max(100).optional(),
  customerCode: codeSchema,
  warehouseCode: codeSchema,
  vehicleNo: z.string().trim().min(1).max(100),
  lines: z.array(z.strictObject({
    productCode: codeSchema,
    plannedPackages: z.number().int().positive().max(1_000_000),
    plannedWeightGrams: gramsSchema,
  })).min(1).max(50).refine((lines) => new Set(lines.map((line) => line.productCode)).size === lines.length, '商品不能重复'),
});
export const createOutboundPlanSchema = outboundPlanFieldsSchema;
export const editOutboundPlanSchema = z.strictObject({
  revision: z.number().int().nonnegative(),
  digest: z.string().regex(/^[a-f0-9]{64}$/),
  plan: outboundPlanFieldsSchema,
});
export type OutboundPlanFields = z.infer<typeof outboundPlanFieldsSchema>;
