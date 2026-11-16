import { z } from 'zod';
import { auditRowSchema } from './audit.ts';

export const WORKBENCH = {
  ttlMs: 30_000,
  trendDays: 14,
  todoLimit: 5,
  recentLimit: 10,
  vehicleLimit: 10,
  staleDays: 7,
  lockHours: 24,
  catalogDays: 30,
  queryTimeoutMs: 750,
  dayMs: 86_400_000,
  shanghaiOffsetMs: 28_800_000,
} as const;
export const workbenchVerificationSchema = z.enum(['verified', 'unverifiable', 'failed']);
export const workbenchPeriodSchema = z.object({ from: z.string(), to: z.string() });
export const workbenchMetricSchema = z.object({
  value: z.number().finite().nullable(),
  unit: z.enum(['单', '包', '克', '条', '%']),
  period: workbenchPeriodSchema,
  basis: z.literal('posted'),
  verification: workbenchVerificationSchema,
  reason: z.string().nullable(),
});
export function workbenchBlockSchema<T extends z.ZodType>(schema: T) {
  return z.object({
    verification: workbenchVerificationSchema,
    reason: z.string().nullable(),
    data: schema.nullable(),
  });
}
export const workbenchQuantitySchema = z.object({ packages: workbenchMetricSchema, grams: workbenchMetricSchema });
export const workbenchTodoSchema = z.object({
  href: z.string(),
  number: z.string(),
  label: z.string(),
  at: z.string().nullable(),
  warehouse: z.string(),
  elapsedHours: z.number().nonnegative().nullable(),
  overdue: z.boolean(),
});
export const workbenchTodoGroupSchema = z.object({ count: workbenchMetricSchema, items: z.array(workbenchTodoSchema) });
export const workbenchTrendPointSchema = z.object({
  day: z.string(),
  inbound: workbenchQuantitySchema,
  outbound: workbenchQuantitySchema,
});
export const workbenchMovementsSchema = z.object({
  inbound: workbenchQuantitySchema,
  outbound: workbenchQuantitySchema,
  inboundChange: workbenchMetricSchema,
  outboundChange: workbenchMetricSchema,
  points: z.array(workbenchTrendPointSchema),
});
export const workbenchPendingSchema = z.object({
  total: workbenchMetricSchema,
  inbound: workbenchTodoGroupSchema,
  outbound: workbenchTodoGroupSchema,
  stocktake: workbenchTodoGroupSchema,
  stale: workbenchTodoGroupSchema,
  historyReason: z.string(),
  missingScanTime: workbenchMetricSchema,
});
export const workbenchCatalogSchema = z.object({
  version: z.number().int(),
  publishedAt: z.string().nullable(),
  expired: z.boolean(),
  entries: workbenchMetricSchema,
  added: workbenchMetricSchema,
  removed: workbenchMetricSchema,
  weight: workbenchMetricSchema,
});
export const workbenchHandoffSchema = z.object({
  unresolved: workbenchMetricSchema,
  orders: workbenchMetricSchema,
  conflicts: workbenchMetricSchema,
  registeredAt: z.string().nullable(),
  conflictAt: z.string().nullable(),
});
export const workbenchVehiclesSchema = z.object({
  total: workbenchMetricSchema,
  items: z.array(
    z.object({
      vehicle: z.string(),
      number: z.string(),
      label: z.string(),
      href: z.string(),
      count: workbenchMetricSchema,
    }),
  ),
});
export const workbenchLinks = [
  { label: '登记入库', href: '/inbound/new' },
  { label: '新建出库', href: '/outbound/new' },
  { label: '开始盘点', href: '/stocktakes/new' },
  { label: '上传目录', href: '/catalog' },
] as const;
export const workbenchSchema = z.object({
  asOf: z.string(),
  watermark: z.string(),
  basis: z.literal('posted'),
  verification: workbenchVerificationSchema,
  today: workbenchBlockSchema(workbenchMovementsSchema.omit({ points: true })),
  pending: workbenchBlockSchema(workbenchPendingSchema),
  catalogHealth: workbenchBlockSchema(workbenchCatalogSchema),
  handoffEvidence: workbenchBlockSchema(workbenchHandoffSchema),
  vehicleOrders: workbenchBlockSchema(workbenchVehiclesSchema),
  recent: workbenchBlockSchema(z.array(auditRowSchema)),
  shortcuts: workbenchBlockSchema(z.array(z.object({ label: z.string(), href: z.string() }))),
  trend14d: workbenchBlockSchema(z.array(workbenchTrendPointSchema)),
});
export type Workbench = z.infer<typeof workbenchSchema>;
export type WorkbenchMetric = z.infer<typeof workbenchMetricSchema>;
export type WorkbenchPeriod = z.infer<typeof workbenchPeriodSchema>;
export type WorkbenchTodo = z.infer<typeof workbenchTodoSchema>;
export type WorkbenchBlock<T> = { verification: Workbench['verification']; reason: string | null; data: T | null };
