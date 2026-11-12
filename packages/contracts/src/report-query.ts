import { z } from 'zod';
import { inventoryScopeFields, validInventoryScope } from './inventory-scope.ts';
import { reportViewQueryFields } from './report-view.ts';

export const reportKindSchema = z.enum(['report-details', 'report-monthly', 'report-turnover', 'report-aging']);
export type ReportKind = z.infer<typeof reportKindSchema>;
export type BaseReportKind = Extract<ReportKind, 'report-details' | 'report-monthly'>;
const day = z.iso.date();
export const reportQuerySchema = z
  .strictObject({
    ...inventoryScopeFields,
    ...reportViewQueryFields,
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
    (q) =>
      validInventoryScope(q) && q.fromDay <= q.toDay && Date.parse(q.toDay) - Date.parse(q.fromDay) <= 366 * 86400000,
    '请选择不超过 367 天的有效日期范围',
  );
export type ReportQuery = z.infer<typeof reportQuerySchema>;
const derivedEnvelope = {
  ...inventoryScopeFields,
  ...reportViewQueryFields,
  warehouse: z.string().trim().max(200).default(''),
  product: z.string().trim().max(200).default(''),
  page: z.coerce.number().int().min(1).max(100000).default(1),
  pageSize: z.coerce
    .number()
    .pipe(z.union([z.literal(20), z.literal(50), z.literal(100), z.literal(200)]))
    .default(20),
  sortBy: z.enum(['warehouseCode', 'productCode']).default('warehouseCode'),
  direction: z.enum(['asc', 'desc']).default('asc'),
};
const validReportRange = (q: { fromDay: string; toDay: string }) =>
  q.fromDay <= q.toDay && Date.parse(q.toDay) - Date.parse(q.fromDay) <= 366 * 86400000;
export const reportTurnoverQuerySchema = z
  .strictObject({
    ...derivedEnvelope,
    fromDay: day,
    toDay: day,
  })
  .refine(validInventoryScope, 'source与scope必须且只能提供一个')
  .refine(validReportRange, '请选择不超过 367 天的有效日期范围');
export type ReportTurnoverQuery = z.infer<typeof reportTurnoverQuerySchema>;
export const reportAgingQuerySchema = z
  .strictObject({
    ...derivedEnvelope,
    fromDay: day,
    toDay: day,
    cutoffDay: day,
  })
  .refine(validInventoryScope, 'source与scope必须且只能提供一个')
  .refine(validReportRange, '请选择不超过 367 天的有效日期范围');
export type ReportAgingQuery = z.infer<typeof reportAgingQuerySchema>;
