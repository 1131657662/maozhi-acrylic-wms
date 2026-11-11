import { z } from 'zod';
import { OUTBOUND_MAX_LINES } from './outbound-actual.ts';
import { businessDateFields } from './business-date.ts';
import { plateSchema } from './vehicles.ts';
import { outboundBillTypeSchema, DOCUMENT_EXTRA_LIMITS } from './document-types.ts';

const codeSchema = z
  .string()
  .min(1)
  .max(64)
  .regex(/^[a-zA-Z0-9_-]+$/);
export const plannedWeightGramsSchema = z.number().int().positive().max(1_000_000_000).multipleOf(100);
export const outboundMemoSchema = z.string().trim().max(DOCUMENT_EXTRA_LIMITS.memo).nullable().optional();
export const outboundLineExtrasSchema = z.strictObject({
  contractNo: z.string().trim().max(DOCUMENT_EXTRA_LIMITS.contractNo).nullable().optional(),
  memo: z.string().trim().max(DOCUMENT_EXTRA_LIMITS.memo).nullable().optional(),
});
export const outboundPlanFieldsSchema = z.strictObject({
  ...businessDateFields,
  contactId: z.uuid().nullable().optional(),
  orderNo: z.string().trim().min(1).max(100).optional(),
  customerCode: codeSchema,
  warehouseCode: codeSchema,
  vehicleNo: plateSchema,
  memo: outboundMemoSchema,
  billType: outboundBillTypeSchema.default('sales'),
  containerNo: z.string().trim().max(DOCUMENT_EXTRA_LIMITS.containerNo).nullable().optional(),
  lines: z
    .array(
      z.strictObject({
        productCode: codeSchema,
        plannedPackages: z.number().int().positive().max(1_000_000),
        plannedWeightGrams: plannedWeightGramsSchema,
        ...outboundLineExtrasSchema.shape,
      }),
    )
    .min(1)
    .max(OUTBOUND_MAX_LINES),
});
export const createOutboundPlanSchema = outboundPlanFieldsSchema;
export const editOutboundPlanSchema = z.strictObject({
  revision: z.number().int().nonnegative(),
  digest: z.string().regex(/^[a-f0-9]{64}$/),
  plan: outboundPlanFieldsSchema
    .omit({ businessDate: true, backdateConfirmed: true, lines: true })
    .partial()
    .required({ vehicleNo: true })
    .extend({
      billType: outboundBillTypeSchema.optional(),
      lines: z
        .array(
          z.union([
            outboundLineExtrasSchema.extend({ id: codeSchema }),
            z.strictObject({
              productCode: codeSchema,
              plannedPackages: z.number().int().positive().max(1_000_000),
              plannedWeightGrams: plannedWeightGramsSchema,
              ...outboundLineExtrasSchema.shape,
            }),
          ]),
        )
        .max(OUTBOUND_MAX_LINES)
        .optional(),
    }),
});
export type OutboundPlanFields = z.input<typeof outboundPlanFieldsSchema>;
export type EditOutboundPlan = z.infer<typeof editOutboundPlanSchema>;
