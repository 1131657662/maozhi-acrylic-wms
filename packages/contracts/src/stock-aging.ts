import { z } from 'zod';

export const STOCK_AGING_UPPER_DAYS = [30, 60, 90, 180] as const;
const grams = z.number().int().safe().nonnegative();
export const stockAgingSchema = z.strictObject({
  agingBuckets: z.tuple([grams, grams, grams, grams, grams]),
  unagingGrams: z.number().int().safe(),
});
export type StockAging = z.infer<typeof stockAgingSchema>;
