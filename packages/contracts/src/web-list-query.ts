import { z } from 'zod';
import { inventoryScopeFields, validInventoryScope } from './inventory-scope.ts';

export const webListKindSchema = z.enum(['inbound', 'outbound', 'stock', 'audit']);
export type WebListKind = z.infer<typeof webListKindSchema>;
const text = z.string().trim().max(200).default('');
const paging = {
  page: z.coerce.number().int().min(1).max(100000).default(1),
  pageSize: z.coerce
    .number()
    .pipe(z.union([z.literal(20), z.literal(50), z.literal(100), z.literal(200)]))
    .default(20),
  direction: z.enum(['asc', 'desc']).default('desc'),
};
const dates = {
  from: z.string().datetime({ offset: true }).optional(),
  to: z.string().datetime({ offset: true }).optional(),
};
const status = { status: z.string().max(32).optional(), statusMissing: z.literal('true').optional() };
function validRange(value: { from?: string; to?: string; status?: string; statusMissing?: string }): boolean {
  return (
    !(value.from && value.to && Date.parse(value.from) > Date.parse(value.to)) &&
    !(value.status !== undefined && value.statusMissing)
  );
}
export const webInboundQuerySchema = z
  .strictObject({
    ...paging,
    ...dates,
    ...status,
    keyword: text,
    supplier: text,
    warehouse: text,
    postingState: z.enum(['legacy', 'pending', 'confirmed', 'reversed', 'voided']).optional(),
    sortBy: z
      .enum(['createdAt', 'receiptNo', 'supplierName', 'warehouseName', 'status', 'postingState'])
      .default('createdAt'),
  })
  .refine(validRange, '时间范围或状态条件冲突');
export const webOutboundQuerySchema = z
  .strictObject({
    ...paging,
    ...dates,
    ...status,
    keyword: text,
    customer: text,
    warehouse: text,
    vehicle: text,
    sortBy: z
      .enum(['createdAt', 'orderNo', 'customerName', 'warehouseName', 'vehicleNo', 'status'])
      .default('createdAt'),
  })
  .refine(validRange, '时间范围或状态条件冲突');
export const webStockQuerySchema = z
  .strictObject({
    ...paging,
    ...inventoryScopeFields,
    product: text,
    warehouse: text,
    sortBy: z.enum(['warehouseCode', 'productCode', 'productName', 'packages', 'weightGrams']).default('warehouseCode'),
  })
  .refine(validInventoryScope, 'source与scope必须且只能提供一个');
export const webAuditQuerySchema = z
  .strictObject({
    ...paging,
    ...dates,
    action: text,
    target: text,
    traceId: text,
    sortBy: z.enum(['createdAt', 'id', 'action', 'targetId', 'actor']).default('createdAt'),
  })
  .refine(validRange, '开始时间不能晚于结束时间');
export const webStatusOptionsSchema = z.array(z.string().nullable());
export type WebInboundQuery = z.infer<typeof webInboundQuerySchema>;
export type WebOutboundQuery = z.infer<typeof webOutboundQuerySchema>;
export type WebStockQuery = z.infer<typeof webStockQuerySchema>;
export type WebAuditQuery = z.infer<typeof webAuditQuerySchema>;
