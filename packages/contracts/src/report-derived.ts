import { z } from 'zod';
import { inventoryScopeResult } from './inventory-scope.ts';
import { derivedReportMetaSchema } from './report-metadata.ts';
import { reportViewFields } from './report-view.ts';
const integer = z.number().int().safe();
const day = z.iso.date();

const derivedEnvelopeSchema = {
  ...reportViewFields,
  total: integer,
  page: integer,
  pageSize: integer,
  viewToken: z.string(),
  rowTokens: z.record(z.string(), z.string()),
  report: derivedReportMetaSchema,
};
const dimensionFields = {
  id: z.string(),
  warehouseCode: z.string(),
  warehouseName: z.string(),
  productCode: z.string(),
  productName: z.string(),
  source: inventoryScopeResult,
  timeStatus: z.string(),
  watermark: integer,
  checkState: z.enum(['可验证', '不可验证']),
  reasons: z.array(z.string()),
  adjustmentCount: integer,
  stocktakeCount: integer,
  adjustmentSummary: z.string(),
};
export const reportTurnoverRowSchema = z.strictObject({
  ...dimensionFields,
  fromDay: day,
  toDay: day,
  days: integer,
  completeDays: integer,
  netOutboundGrams: integer.nullable(),
  dailyClosingGramsSum: integer.nullable(),
  averageInventory: z.string().nullable(),
  turns: z.string().nullable(),
  turnoverDays: z.string().nullable(),
  formula: z.string(),
});
export type ReportTurnoverRow = z.infer<typeof reportTurnoverRowSchema>;
export const reportAgingRowSchema = z.strictObject({
  ...dimensionFields,
  fromDay: day,
  toDay: day,
  cutoffDay: day,
  closingPackages: integer.nullable(),
  closingGrams: integer.nullable(),
  age0To30Grams: integer.nullable(),
  age31To90Grams: integer.nullable(),
  age91To180Grams: integer.nullable(),
  age181To365Grams: integer.nullable(),
  ageOver365Grams: integer.nullable(),
  unagedGrams: integer.nullable(),
  coverage: z.string().nullable(),
  fifoBasis: z.string(),
});
export type ReportAgingRow = z.infer<typeof reportAgingRowSchema>;
const turnoverTotalsSchema = z.strictObject({
  netOutboundGrams: integer.nullable(),
  dailyClosingGramsSum: integer.nullable(),
});
const agingTotalsSchema = z.strictObject({
  closingPackages: integer.nullable(),
  age0To30Grams: integer.nullable(),
  age31To90Grams: integer.nullable(),
  age91To180Grams: integer.nullable(),
  age181To365Grams: integer.nullable(),
  ageOver365Grams: integer.nullable(),
  unagedGrams: integer.nullable(),
  closingGrams: integer.nullable(),
});
export type ReportTurnoverTotals = z.infer<typeof turnoverTotalsSchema>;
export type ReportAgingTotals = z.infer<typeof agingTotalsSchema>;
export const reportTurnoverSchema = z.strictObject({
  ...derivedEnvelopeSchema,
  items: z.array(reportTurnoverRowSchema),
  totals: turnoverTotalsSchema,
});
export const reportAgingSchema = z.strictObject({
  ...derivedEnvelopeSchema,
  items: z.array(reportAgingRowSchema),
  totals: agingTotalsSchema,
});
