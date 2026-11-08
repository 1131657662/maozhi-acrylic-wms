import { z } from 'zod';
import { inboundReceiptSchema } from './inbound.ts';

const integer = z.number().int().safe();
export const webInboundRowSchema = inboundReceiptSchema
  .omit({ lines: true })
  .extend({ products: z.array(z.string()) })
  .strict();
export const webOutboundRowSchema = z.strictObject({
  id: z.string(),
  orderNo: z.string(),
  customerName: z.string(),
  warehouseCode: z.string(),
  warehouseName: z.string(),
  vehicleNo: z.string(),
  status: z.string(),
  createdAt: z.string(),
  plannedPackages: integer,
  plannedWeightGrams: integer,
  actualPackages: integer,
  actualWeightGrams: integer,
});
export const webStockRowSchema = z.strictObject({
  id: z.string(),
  source: z.literal('erp-product'),
  sourceKind: z.literal('erp-product'),
  warehouseCode: z.string(),
  warehouseName: z.string(),
  productCode: z.string(),
  productName: z.string(),
  packages: integer,
  weightGrams: integer,
});
export const webAuditRowSchema = z.strictObject({
  id: integer,
  action: z.string(),
  targetId: z.string(),
  actor: z.string(),
  traceId: z.string(),
  createdAt: z.string(),
});
export const webAuditDetailSchema = webAuditRowSchema.extend({ beforeJson: z.string(), afterJson: z.string() });
const envelope = {
  total: integer.nonnegative(),
  page: integer.positive(),
  pageSize: integer.positive(),
  viewToken: z.string(),
};
export const webInboundListSchema = z.strictObject({ ...envelope, items: z.array(webInboundRowSchema) });
export const webOutboundListSchema = z.strictObject({ ...envelope, items: z.array(webOutboundRowSchema) });
export const webStockListSchema = z.strictObject({
  ...envelope,
  source: z.literal('erp-product'),
  items: z.array(webStockRowSchema),
  subtotal: z.strictObject({ packages: integer, weightGrams: integer }),
});
export const webAuditListSchema = z.strictObject({ ...envelope, items: z.array(webAuditRowSchema) });
export type WebInboundRow = z.infer<typeof webInboundRowSchema>;
export type WebOutboundRow = z.infer<typeof webOutboundRowSchema>;
export type WebStockRow = z.infer<typeof webStockRowSchema>;
export type WebAuditRow = z.infer<typeof webAuditRowSchema>;
export type WebAuditDetail = z.infer<typeof webAuditDetailSchema>;
