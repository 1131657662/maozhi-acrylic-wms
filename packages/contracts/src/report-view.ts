import { z } from 'zod';

const integer = z.number().int().safe();
export const reportViewQueryFields = {
  basis: z.enum(['posted', 'restated']).default('posted'),
  asOf: z.iso.datetime({ offset: true }).optional(),
};
export const reportWatermarksSchema = z.strictObject({
  journalMaxId: integer.nonnegative(),
  dateCorrectionMaxId: z.uuid().nullable(),
  asOf: z.iso.datetime(),
});
export type ReportWatermarks = z.infer<typeof reportWatermarksSchema>;
export const reportBridgeRowSchema = z.strictObject({
  month: z
    .string()
    .regex(/^\d{4}-\d{2}$/)
    .nullable(),
  category: z.enum(['入库', '出库', '更正', '盘点', '期初', '其他']),
  inRange: z.boolean(),
  postedPackages: integer,
  postedGrams: integer,
  restatedPackages: integer,
  restatedGrams: integer,
  deltaPackages: integer,
  deltaGrams: integer,
  reason: z.string().optional(),
});
export type ReportBridgeRow = z.infer<typeof reportBridgeRowSchema>;
export const restatedBalanceSchema = z.strictObject({
  openingPackages: integer.nullable(),
  openingGrams: integer.nullable(),
  closingPackages: integer.nullable(),
  closingGrams: integer.nullable(),
  differencePackages: integer.nullable(),
  differenceGrams: integer.nullable(),
  checkState: z.enum(['可验证', '不可验证']),
  reasons: z.array(z.string()),
});
export type RestatedBalance = z.infer<typeof restatedBalanceSchema>;
export const reportViewFields = {
  basis: z.enum(['posted', 'restated']),
  watermarks: reportWatermarksSchema,
  balanceMode: z.enum(['posted', 'restated', 'unverifiable']),
  bridge: z.array(reportBridgeRowSchema).optional(),
  restatedBalance: restatedBalanceSchema.optional(),
  inventoryBasis: z.literal('posted'),
};
export const reportViewSchema = z.strictObject(reportViewFields);
export type ReportView = z.infer<typeof reportViewSchema>;
