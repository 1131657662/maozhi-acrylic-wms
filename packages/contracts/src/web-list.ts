import { z } from 'zod';
import { inventoryScopeResult } from './inventory-scope.ts';
import { inboundReceiptSchema } from './inbound.ts';
import { auditRowSchema, auditDetailSchema, auditStatisticsSchema } from './audit.ts';

const integer = z.number().int().safe();
export const webMatchedLineSchema = z.strictObject({
  lineId: z.string(),
  productCode: z.string(),
  productName: z.string(),
  packages: integer.nonnegative(),
  weightGrams: integer.nonnegative(),
});
export type WebMatchedLine = z.infer<typeof webMatchedLineSchema>;
export const webMatchedTotalsSchema = z.strictObject({
  documentCount: integer.nonnegative(),
  lineCount: integer.nonnegative(),
  packages: integer.nonnegative(),
  weightGrams: integer.nonnegative(),
});
export type WebMatchedTotals = z.infer<typeof webMatchedTotalsSchema>;
export const webInboundRowSchema = inboundReceiptSchema
  .omit({ lines: true, businessDate: true, corrections: true })
  .extend({
    products: z.array(z.string()),
    productModels: z.array(z.string()),
    matchedLineCount: integer.nonnegative().optional(),
    matchedLines: z.array(webMatchedLineSchema).optional(),
  })
  .strict();
export const webOutboundRowSchema = z.strictObject({
  id: z.string(),
  orderNo: z.string(),
  products: z.array(z.string()),
  productModels: z.array(z.string()),
  customerName: z.string(),
  shipToName: z.string().nullable().optional(),
  shipToPhone: z.string().nullable().optional(),
  shipToAddress: z.string().nullable().optional(),
  warehouseCode: z.string(),
  warehouseName: z.string(),
  vehicleNo: z.string(),
  status: z.string(),
  createdAt: z.string(),
  plannedPackages: integer,
  plannedWeightGrams: integer,
  actualPackages: integer,
  actualWeightGrams: integer,
  matchedLineCount: integer.nonnegative().optional(),
  matchedLines: z.array(webMatchedLineSchema).optional(),
});
export const webStockRowSchema = z.strictObject({
  id: z.string(),
  source: inventoryScopeResult,
  sourceKind: z.string(),
  warehouseCode: z.string(),
  warehouseName: z.string(),
  productCode: z.string(),
  productName: z.string(),
  packages: integer,
  weightGrams: integer,
});
export const webAuditRowSchema = auditRowSchema;
export const webAuditDetailSchema = auditDetailSchema;
const envelope = {
  total: integer.nonnegative(),
  page: integer.positive(),
  pageSize: integer.positive(),
  viewToken: z.string(),
  rowTokens: z.record(z.string(), z.string()).optional(),
};
export const webInboundListSchema = z.strictObject({
  ...envelope,
  matchedTotals: webMatchedTotalsSchema.optional(),
  items: z.array(webInboundRowSchema),
});
export const webOutboundListSchema = z.strictObject({
  ...envelope,
  matchedTotals: webMatchedTotalsSchema.optional(),
  items: z.array(webOutboundRowSchema),
});
export const webStockListSchema = z.strictObject({
  ...envelope,
  source: inventoryScopeResult,
  items: z.array(webStockRowSchema),
  subtotal: z.strictObject({ packages: integer, weightGrams: integer }),
});
export const webAuditListSchema = z.strictObject({
  ...envelope,
  items: z.array(webAuditRowSchema),
  statistics: auditStatisticsSchema.optional(),
});
export type WebInboundRow = z.infer<typeof webInboundRowSchema>;
export type WebOutboundRow = z.infer<typeof webOutboundRowSchema>;
export type WebStockRow = z.infer<typeof webStockRowSchema>;
export type WebAuditRow = z.infer<typeof webAuditRowSchema>;
export type WebAuditDetail = z.infer<typeof webAuditDetailSchema>;
