import { z } from 'zod';
import { inventoryScopeFields, validInventoryScope } from './inventory-scope.ts';
import { WEB_LIST_DEFAULT_PAGE_SIZE, WEB_LIST_PAGE_SIZES } from './list-display.ts';
import { inboundBillTypeSchema, outboundBillTypeSchema } from './document-types.ts';

export const webListKindSchema = z.enum(['inbound', 'outbound', 'stock', 'audit']);
export type WebListKind = z.infer<typeof webListKindSchema>;
const text = z.string().trim().max(200).default('');
const paging = {
  page: z.coerce.number().int().min(1).max(100000).default(1),
  pageSize: z.coerce
    .number()
    .int()
    .refine((value) => WEB_LIST_PAGE_SIZES.includes(value as (typeof WEB_LIST_PAGE_SIZES)[number]))
    .default(WEB_LIST_DEFAULT_PAGE_SIZE),
  direction: z.enum(['asc', 'desc']).default('desc'),
};
const dates = {
  from: z.string().datetime({ offset: true }).optional(),
  to: z.string().datetime({ offset: true }).optional(),
};
const status = { status: z.string().max(32).optional(), statusMissing: z.literal('true').optional() };
const productCodes = z.preprocess(
  (value) => {
    const values = Array.isArray(value) ? value : [value];
    const codes = values.flatMap((entry) => (typeof entry === 'string' ? entry.split(',') : []));
    const normalized = [...new Set(codes.map((code) => code.trim()).filter(Boolean))];
    return normalized.length ? normalized : undefined;
  },
  z.array(z.string().min(1).max(80)).max(100).optional(),
);
const productReverse = { productCodes, productMode: z.enum(['any', 'all']).default('any') };
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
    ...productReverse,
    keyword: text,
    supplier: text,
    warehouse: text,
    postingState: z.enum(['legacy', 'pending', 'confirmed', 'reversed', 'voided']).optional(),
    billType: inboundBillTypeSchema.optional(),
    sortBy: z
      .enum([
        'createdAt',
        'receiptNo',
        'supplierName',
        'warehouseName',
        'status',
        'postingState',
        'packages',
        'weightGrams',
      ])
      .default('createdAt'),
  })
  .refine(validRange, '时间范围或状态条件冲突');
export const webOutboundQuerySchema = z
  .strictObject({
    ...paging,
    ...dates,
    ...status,
    ...productReverse,
    billType: outboundBillTypeSchema.optional(),
    keyword: text,
    customer: text,
    warehouse: text,
    vehicle: text,
    sortBy: z
      .enum([
        'createdAt',
        'orderNo',
        'customerName',
        'warehouseName',
        'vehicleNo',
        'status',
        'plannedPackages',
        'plannedWeightGrams',
        'actualPackages',
        'actualWeightGrams',
      ])
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
    keyword: text,
    channel: z.enum(['web', 'pda', 'miniapp', 'missing']).optional(),
    result: z.enum(['success', 'failed', 'cancelled', 'unknown', 'missing']).optional(),
    dangerous: z.enum(['true', 'false']).optional(),
    sortBy: z.enum(['createdAt', 'id', 'action', 'targetId', 'objectLabel', 'actor']).default('createdAt'),
  })
  .refine(validRange, '开始时间不能晚于结束时间');
export const webStatusOptionsSchema = z.array(z.string().nullable());
export type WebInboundQuery = z.infer<typeof webInboundQuerySchema>;
export type WebOutboundQuery = z.infer<typeof webOutboundQuerySchema>;
export type WebStockQuery = z.infer<typeof webStockQuerySchema>;
export type WebAuditQuery = z.infer<typeof webAuditQuerySchema>;
