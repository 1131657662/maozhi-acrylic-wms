import { z } from 'zod';
import { businessDateFields } from './business-date.ts';

const codeSchema = z
  .string()
  .min(1)
  .max(64)
  .regex(/^[a-zA-Z0-9_-]+$/);
export const plannedWeightGramsSchema = z.number().int().positive().max(1_000_000_000).multipleOf(100);
export const outboundMemoSchema = z.string().trim().max(500).nullable().optional();
export const outboundPlanFieldsSchema = z.strictObject({
  ...businessDateFields,
  orderNo: z.string().trim().min(1).max(100).optional(),
  customerCode: codeSchema,
  warehouseCode: codeSchema,
  vehicleNo: z.string().trim().min(1).max(100),
  memo: outboundMemoSchema,
  lines: z
    .array(
      z.strictObject({
        productCode: codeSchema,
        plannedPackages: z.number().int().positive().max(1_000_000),
        plannedWeightGrams: plannedWeightGramsSchema,
      }),
    )
    .min(1)
    .max(50)
    .refine((lines) => new Set(lines.map((line) => line.productCode)).size === lines.length, '商品不能重复'),
});
export const createOutboundPlanSchema = outboundPlanFieldsSchema;
export const editOutboundPlanSchema = z.strictObject({
  revision: z.number().int().nonnegative(),
  digest: z.string().regex(/^[a-f0-9]{64}$/),
  plan: outboundPlanFieldsSchema
    .omit({ businessDate: true, backdateConfirmed: true })
    .partial()
    .required({ vehicleNo: true })
    .extend({
      lines: z.array(outboundPlanFieldsSchema.shape.lines.element).max(50).optional(),
    }),
});
export type OutboundPlanFields = z.infer<typeof outboundPlanFieldsSchema>;
export type EditOutboundPlan = z.infer<typeof editOutboundPlanSchema>;
