import { z } from 'zod';

export const AUDIT_RAW_PREVIEW_BYTES = 256 * 1024;
export const AUDIT_DIAGNOSTIC_BYTES = 100 * 1024 * 1024;
export const AUDIT_MAX_RECORDS = 100_000;
export const AUDIT_OBJECT_PAGE_SIZE = 20;
export const AUDIT_EVENT_PAGE_SIZE = 50;
export const AUDIT_DEFAULT_DAYS = 7;
export const AUDIT_RAW_MAX_PAGE_SIZE = 200;
export const auditCursorQuerySchema = z.strictObject({ cursor: z.string().max(1000).optional() });
export const auditRawQuerySchema = auditCursorQuerySchema.extend({
  traceId: z.string().min(1).max(80).optional(),
  pageSize: z.coerce.number().int().min(1).max(AUDIT_RAW_MAX_PAGE_SIZE).default(AUDIT_EVENT_PAGE_SIZE),
});
export const auditIdSchema = z.string().regex(/^(event:[1-9]\d*|attempt:[0-9a-f-]{36})$/);
export const auditChangeSchema = z.strictObject({
  field: z.string(),
  label: z.string(),
  before: z.string(),
  after: z.string(),
  unit: z.string(),
});
export const auditRowSchema = z.strictObject({
  id: auditIdSchema,
  source: z.enum(['business_event', 'attempt']),
  sourceId: z.string(),
  action: z.string(),
  objectType: z.string(),
  objectLabel: z.string(),
  href: z.string().nullable(),
  actor: z.string(),
  createdAt: z.string(),
  summary: z.string(),
  channel: z.string(),
  result: z.string(),
  effect: z.string(),
  dangerous: z.boolean(),
});
export const auditPageSchema = z.strictObject({
  items: z.array(auditRowSchema),
  total: z.number(),
  nextCursor: z.string().nullable(),
});
export const auditDetailSchema = auditRowSchema.extend({
  changes: z.array(auditChangeSchema),
  related: auditPageSchema,
});
export const auditTimelineSchema = z.strictObject({
  items: z.array(
    z.strictObject({
      id: auditIdSchema,
      objectType: z.string(),
      objectLabel: z.string(),
      href: z.string().nullable(),
      events: auditPageSchema,
    }),
  ),
  total: z.number(),
  page: z.number(),
  pageSize: z.number(),
});
export const auditRawSchema = z.strictObject({
  items: z.array(z.record(z.string(), z.unknown())),
  total: z.number(),
  nextCursor: z.string().nullable(),
  traceId: z.string(),
});
export type AuditChange = z.infer<typeof auditChangeSchema>;
export type AuditRow = z.infer<typeof auditRowSchema>;
export const auditChannelText = (v: unknown) => mapped(v, { web: '网页端', pda: '手持终端', miniapp: '小程序' });
export const auditResultText = (v: unknown) =>
  mapped(v, { success: '完成', failed: '失败', cancelled: '已取消', unknown: '结果待核实' });
export const auditEffectText = (v: unknown) =>
  mapped(v, { applied: '已生效', not_applied: '未生效', unknown: '结果待核实' });
function mapped(value: unknown, values: Record<string, string>): string {
  return value == null ? '未记录' : Object.hasOwn(values, String(value)) ? values[String(value)]! : '未识别';
}
