import { z } from 'zod';
import { confirmOutboundSchema, OUTBOUND_MAX_LINES, OUTBOUND_ACTUAL_PRECISION_GRAMS } from './outbound-actual.ts';
import { businessDateFields } from './business-date.ts';
import { plateSchema } from './vehicles.ts';
import { outboundBillTypeSchema } from './document-types.ts';
import { shipmentLineIdSchema } from './corrections.ts';

export const shipmentInputSchema = confirmOutboundSchema.extend({
  vehicleNo: plateSchema.optional(),
  ...businessDateFields,
});
export const completeShipmentSchema = confirmOutboundSchema.omit({ lines: true });
export const shortCloseSchema = completeShipmentSchema.extend({ reason: z.string().trim().min(1).max(500) });
const quantity = {
  plannedPackages: z.number().int().positive().max(1_000_000),
  plannedWeightGrams: z.number().int().positive().max(1_000_000_000).multipleOf(OUTBOUND_ACTUAL_PRECISION_GRAMS),
};
const extras = {
  contractNo: z.string().trim().max(80).nullable().optional(),
  memo: z.string().trim().max(500).nullable().optional(),
};
export const shipmentPlanLineSchema = z.strictObject({ id: z.string().min(1).max(80), ...quantity, ...extras });
export const shipmentPlanSchema = completeShipmentSchema.extend({
  plan: z.strictObject({
    vehicleNo: plateSchema.optional(),
    memo: extras.memo,
    containerNo: z.string().trim().max(64).nullable().optional(),
    billType: outboundBillTypeSchema.optional(),
    lines: z.array(shipmentPlanLineSchema).max(OUTBOUND_MAX_LINES).optional(),
  }),
});
export const shipmentSchema = z.object({
  id: z.string(),
  seq: z.number().int().positive(),
  vehicleNo: z.string(),
  shippedAt: z.string(),
  businessDate: z.string(),
  operator: z.string(),
  packages: z.number().int(),
  weightGrams: z.number().int(),
  effectivePackages: z.number().int(),
  effectiveWeightGrams: z.number().int(),
  lines: z.array(
    z.object({
      lineId: z.string(),
      shipmentLineId: shipmentLineIdSchema,
      productCode: z.string(),
      productName: z.string(),
      packages: z.number().int(),
      weightGrams: z.number().int(),
      effectivePackages: z.number().int(),
      effectiveWeightGrams: z.number().int(),
      correctionPackages: z.number().int(),
      correctionWeightGrams: z.number().int(),
      overageReason: z.string().nullable(),
    }),
  ),
});
export const shipmentQuantitySchema = z.object({
  lineId: z.string(),
  productCode: z.string(),
  productName: z.string(),
  contractNo: z.string().nullable(),
  memo: z.string().nullable(),
  plannedPackages: z.number().int(),
  plannedWeightGrams: z.number().int(),
  effectivePackages: z.number().int(),
  effectiveWeightGrams: z.number().int(),
  remainingPackages: z.number().int().nonnegative(),
  remainingWeightGrams: z.number().int().nonnegative(),
  prefillPackages: z.number().int().nonnegative().nullable(),
  prefillWeightGrams: z.number().int().nonnegative().nullable(),
});
export const shipmentListSchema = z.object({
  items: z.array(shipmentSchema),
  revision: z.number().int(),
  digest: z.string(),
  status: z.string(),
  vehicleNo: z.string(),
  nextSeq: z.number().int().positive(),
  plannedPackages: z.number().int(),
  plannedWeightGrams: z.number().int(),
  effectivePackages: z.number().int(),
  effectiveWeightGrams: z.number().int(),
  lines: z.array(shipmentQuantitySchema),
  remainingPackages: z.number().int(),
  remainingWeightGrams: z.number().int(),
  completedAt: z.string().nullable(),
  shortClosure: z
    .object({ at: z.string(), reason: z.string(), packages: z.number().int(), weightGrams: z.number().int() })
    .nullable(),
});
export type ShipmentInput = z.infer<typeof shipmentInputSchema>;
export type ShipmentPlan = z.infer<typeof shipmentPlanSchema>;
export type ShipmentList = z.infer<typeof shipmentListSchema>;
export type ShipmentQuantity = z.infer<typeof shipmentQuantitySchema>;
