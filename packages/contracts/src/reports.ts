import { z } from 'zod';

export const reportKindSchema = z.enum(['report-details', 'report-monthly', 'report-turnover', 'report-aging']);
export type ReportKind = z.infer<typeof reportKindSchema>;
export type BaseReportKind = Extract<ReportKind, 'report-details' | 'report-monthly'>;
const day = z.iso.date();
export const reportQuerySchema = z
  .strictObject({
    source: z.literal('erp-product'),
    fromDay: day,
    toDay: day,
    warehouse: z.string().trim().max(200).default(''),
    product: z.string().trim().max(200).default(''),
    movement: z.enum(['all', 'inbound', 'outbound']).default('all'),
    page: z.coerce.number().int().min(1).max(100000).default(1),
    pageSize: z.coerce
      .number()
      .pipe(z.union([z.literal(20), z.literal(50), z.literal(100), z.literal(200)]))
      .default(20),
    sortBy: z.enum(['postedAt', 'period', 'productCode', 'warehouseCode']).default('postedAt'),
    direction: z.enum(['asc', 'desc']).default('desc'),
  })
  .refine(
    (q) => q.fromDay <= q.toDay && Date.parse(q.toDay) - Date.parse(q.fromDay) <= 366 * 86400000,
    '请选择不超过 367 天的有效日期范围',
  );
export type ReportQuery = z.infer<typeof reportQuerySchema>;
const derivedEnvelope = {
  source: z.literal('erp-product'),
  warehouse: z.string().trim().max(200).default(''),
  product: z.string().trim().max(200).default(''),
  page: z.coerce.number().int().min(1).max(100000).default(1),
  pageSize: z.coerce.number().pipe(z.union([z.literal(20), z.literal(50), z.literal(100), z.literal(200)])).default(20),
  sortBy: z.enum(['warehouseCode', 'productCode']).default('warehouseCode'),
  direction: z.enum(['asc', 'desc']).default('asc'),
};
const validReportRange = (q: { fromDay: string; toDay: string }) =>
  q.fromDay <= q.toDay && Date.parse(q.toDay) - Date.parse(q.fromDay) <= 366 * 86400000;
export const reportTurnoverQuerySchema = z.strictObject({
  ...derivedEnvelope,
  fromDay: day,
  toDay: day,
}).refine(validReportRange, '请选择不超过 367 天的有效日期范围');
export type ReportTurnoverQuery = z.infer<typeof reportTurnoverQuerySchema>;
export const reportAgingQuerySchema = z.strictObject({
  ...derivedEnvelope,
  fromDay: day,
  toDay: day,
  cutoffDay: day,
}).refine(validReportRange, '请选择不超过 367 天的有效日期范围');
export type ReportAgingQuery = z.infer<typeof reportAgingQuerySchema>;
const integer = z.number().int().safe();
export const reportBalanceSchema = z.strictObject({
  openingPackages: integer.nullable(),
  openingGrams: integer.nullable(),
  inboundPackages: integer,
  inboundGrams: integer,
  outboundPackages: integer,
  outboundGrams: integer,
  adjustmentPackages: integer,
  adjustmentGrams: integer,
  closingPackages: integer.nullable(),
  closingGrams: integer.nullable(),
  differencePackages: integer.nullable(),
  differenceGrams: integer.nullable(),
  checkState: z.enum(['可验证', '不可验证']),
  reasons: z.array(z.string()),
});
export type ReportBalance = z.infer<typeof reportBalanceSchema>;
export const reportMonthlyRowSchema = reportBalanceSchema.extend({
  id: z.string(),
  period: z.string(),
  warehouseCode: z.string(),
  warehouseName: z.string(),
  productCode: z.string(),
  productName: z.string(),
  timeStatus: z.string(),
  inboundConfirmedPackages: integer,
  inboundConfirmedGrams: integer,
  inboundReversedPackages: integer,
  inboundReversedGrams: integer,
  outboundConfirmedPackages: integer,
  outboundConfirmedGrams: integer,
  outboundReversedPackages: integer,
  outboundReversedGrams: integer,
  manualPackages: integer,
  manualGrams: integer,
  countPackages: integer,
  countGrams: integer,
  importPackages: integer,
  importGrams: integer,
  unknownPackages: integer,
  unknownGrams: integer,
  netPackages: integer,
  netGrams: integer,
  inboundDocuments: integer.nullable(),
  outboundDocuments: integer.nullable(),
  inboundReversals: integer.nullable(),
  outboundReversals: integer.nullable(),
});
export type ReportMonthlyRow = z.infer<typeof reportMonthlyRowSchema>;
export const reportDetailRowSchema = z.strictObject({
  id: z.string(),
  postedAt: z.string().nullable(),
  businessDate: z.string().nullable(),
  createdAt: z.string().nullable(),
  confirmedAt: z.string().nullable(),
  warehouseCode: z.string(),
  warehouseName: z.string(),
  productCode: z.string(),
  productName: z.string(),
  productModel: z.string(),
  nameBasis: z.string(),
  orderNo: z.string(),
  documentId: z.string().nullable(),
  operationId: z.string().nullable(),
  originalOperationId: z.string().nullable(),
  operationType: z.string(),
  operationLabel: z.string(),
  directionLabel: z.string(),
  packages: integer,
  weightGrams: integer,
  deltaPackages: integer,
  deltaGrams: integer,
  beforePackages: integer.nullable(),
  beforeGrams: integer.nullable(),
  afterPackages: integer.nullable(),
  afterGrams: integer.nullable(),
  partner: z.string(),
  vehicleNo: z.string(),
  containerNo: z.string(),
  billType: z.string(),
  referenceNo: z.string(),
  status: z.string(),
  actor: z.string(),
  reason: z.string(),
  timeStatus: z.string(),
  checkState: z.string(),
});
export type ReportDetailRow = z.infer<typeof reportDetailRowSchema>;
export const reportMetaSchema = z.strictObject({
  source: z.literal('erp-product'),
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
const envelope = {
  total: integer,
  page: integer,
  pageSize: integer,
  viewToken: z.string(),
  rowTokens: z.record(z.string(), z.string()),
  report: reportMetaSchema,
};
export const reportDetailsSchema = z.strictObject({ ...envelope, items: z.array(reportDetailRowSchema) });
export const reportMonthlySchema = z.strictObject({ ...envelope, items: z.array(reportMonthlyRowSchema) });
const derivedEnvelopeSchema = {
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
  source: z.literal('erp-product'),
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
