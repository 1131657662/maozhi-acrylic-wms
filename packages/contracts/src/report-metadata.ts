import { z } from 'zod';
import { inventoryScopeResult } from './inventory-scope.ts';
const integer = z.number().int().safe();
const day = z.iso.date();

export const reportBalanceSchema = z.strictObject({
  openingPackages: integer.nullable(),
  openingGrams: integer.nullable(),
  inboundPackages: integer,
  inboundGrams: integer,
  outboundPackages: integer,
  outboundGrams: integer,
  adjustmentPackages: integer,
  adjustmentGrams: integer,
  otherMovementPackages: integer.default(0),
  otherMovementGrams: integer.default(0),
  closingPackages: integer.nullable(),
  closingGrams: integer.nullable(),
  differencePackages: integer.nullable(),
  differenceGrams: integer.nullable(),
  checkState: z.enum(['可验证', '不可验证']),
  reasons: z.array(z.string()),
});
export type ReportBalance = z.infer<typeof reportBalanceSchema>;
export const reportMetaSchema = z.strictObject({
  source: inventoryScopeResult,
  fromDay: day,
  toDay: day,
  watermark: integer,
  timeStatus: z.string(),
  excludedDeleted: integer,
  missingTime: integer,
  unassignedRows: integer,
  unverifiedCells: integer,
  totalCells: integer,
  reconciliation: reportBalanceSchema,
});
export type ReportMeta = z.infer<typeof reportMetaSchema>;
export const derivedReportMetaSchema = reportMetaSchema.extend({
  days: integer,
  completeDays: integer,
  scopeStatus: z.enum(['complete', 'incomplete', 'empty']),
  formula: z.string(),
  countFromDay: day,
  countToDay: day,
  adjustmentCount: integer,
  stocktakeCount: integer,
});
export type DerivedReportMeta = z.infer<typeof derivedReportMetaSchema>;
