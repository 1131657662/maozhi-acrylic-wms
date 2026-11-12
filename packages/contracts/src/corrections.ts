import { z } from 'zod';

export const correctionKindSchema = z.enum(['inbound', 'outbound']);
export const correctionCopy = {
  chooseShipment: '选择发货批次',
  shipment: (seq: number, vehicle: string, date: string) => `第 ${seq} 次发货 · ${vehicle || '车号未记录'} · ${date}`,
};
// BIGINT identifiers travel as decimal strings without JS Number precision loss.
export const shipmentLineIdSchema = z
  .string()
  .regex(/^[1-9][0-9]{0,19}$/)
  .refine((value) => value.length < 20 || value <= '18446744073709551615', '发货行编号无效');
const quantity = z.object({ packages: z.number().int(), weightGrams: z.number().int() });
export const correctionInputSchema = z.strictObject({
  expectedCorrectionRevision: z.number().int().nonnegative(),
  previousCorrectionId: z.uuid().nullable(),
  reason: z.string().trim().min(1).max(500),
  lines: z
    .array(
      z.strictObject({
        originalLineId: z.string().min(1).max(80),
        shipmentLineId: shipmentLineIdSchema.optional(),
        packages: z.number().int().min(0).max(1_000_000),
        weightGrams: z.number().int().min(0).max(99_999_999_999_900).multipleOf(100),
      }),
    )
    .min(1)
    .max(50),
});
export const correctionLineSchema = z.object({
  originalLineId: z.string(),
  shipmentLineId: shipmentLineIdSchema.nullable().optional(),
  shipment: z
    .object({ seq: z.number().int().positive(), vehicleNo: z.string(), shippedAt: z.string() })
    .nullable()
    .optional(),
  productCode: z.string(),
  before: quantity,
  after: quantity,
  delta: quantity,
});
export const correctionSchema = z.object({
  id: z.uuid(),
  number: z.string(),
  kind: correctionKindSchema,
  originalId: z.string(),
  previousCorrectionId: z.uuid().nullable(),
  revision: z.number().int(),
  reason: z.string(),
  actor: z.string(),
  createdAt: z.string(),
  operationId: z.uuid(),
  offsetOperationId: z.uuid().nullable(),
  lines: z.array(correctionLineSchema),
});
export const correctionSummarySchema = z.object({
  revision: z.number().int(),
  allowed: z.boolean(),
  offset: z.boolean(),
  original: quantity,
  effective: quantity,
  delta: quantity,
  latest: z.object({ id: z.uuid(), number: z.string(), createdAt: z.string() }).nullable(),
  lines: z.array(
    z.object({
      originalLineId: z.string(),
      productCode: z.string(),
      productName: z.string(),
      shipments: z
        .array(
          z.object({
            shipmentLineId: shipmentLineIdSchema,
            seq: z.number().int(),
            vehicleNo: z.string(),
            shippedAt: z.string(),
            original: quantity,
            effective: quantity,
          }),
        )
        .optional(),
      original: quantity,
      effective: quantity,
      delta: quantity,
    }),
  ),
  records: z.array(correctionSchema),
});
export type CorrectionKind = z.infer<typeof correctionKindSchema>;
export type CorrectionInput = z.infer<typeof correctionInputSchema>;
export type Correction = z.infer<typeof correctionSchema>;
export type CorrectionSummary = z.infer<typeof correctionSummarySchema>;
export interface CorrectionTarget {
  kind: CorrectionKind;
  id: string;
}
