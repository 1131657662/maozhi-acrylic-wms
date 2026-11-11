import { z } from 'zod';

export const OUTBOUND_MAX_LINES = 50;
export const OUTBOUND_ACTUAL_MAX_PACKAGES = 2_147_483_647;
export const OUTBOUND_ACTUAL_MAX_GRAMS = 99_999_999_999_900;
export const OUTBOUND_ACTUAL_PRECISION_GRAMS = 100;
export const actualQuantitySchema = z.strictObject({
  lineId: z.string().min(1).max(80),
  actualPackages: z.number().int().nonnegative().max(OUTBOUND_ACTUAL_MAX_PACKAGES),
  actualWeightGrams: z
    .number()
    .int()
    .nonnegative()
    .max(OUTBOUND_ACTUAL_MAX_GRAMS)
    .multipleOf(OUTBOUND_ACTUAL_PRECISION_GRAMS),
  overageReason: z.string().trim().max(500).optional(),
});
export const confirmOutboundSchema = z.strictObject({
  revision: z.number().int().nonnegative(),
  digest: z.string().regex(/^[a-f0-9]{64}$/),
  lines: z.array(actualQuantitySchema).min(1).max(OUTBOUND_MAX_LINES),
});
export const outboundPrefillSchema = z.object({
  id: z.string(),
  revision: z.number().int(),
  digest: z.string(),
  lines: z.array(
    z.object({
      lineId: z.string(),
      scanPackages: z.number().int().nonnegative(),
      scanWeightGrams: z.number().int().nonnegative(),
    }),
  ),
});
export type ActualQuantity = z.infer<typeof actualQuantitySchema>;
export type ConfirmOutbound = z.infer<typeof confirmOutboundSchema>;
