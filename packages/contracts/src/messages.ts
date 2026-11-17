import { z } from 'zod';

export const MESSAGES = {
  pageSize: 50,
  maxPage: 10000,
  pollMs: 60000,
  scanIntervalMs: 60000,
  pendingHours: 2,
  retentionDays: 90,
  hourMs: 3600000,
  dayMs: 86400000,
  differenceRatio: 0.1,
  differencePackages: 50,
  queryTimeoutMs: 5000,
  badgeMax: 99,
} as const;
export const messageTypeSchema = z.enum([
  'pending',
  'shipment_overdue',
  'stocktake_overdue',
  'catalog_stale',
  'backup_failed',
  'anomaly',
]);
export type MessageType = z.infer<typeof messageTypeSchema>;
export const messageTypeText: Record<MessageType, string> = {
  pending: '待确认',
  shipment_overdue: '发货超时',
  stocktake_overdue: '盘点未结束',
  catalog_stale: '目录待更新',
  backup_failed: '备份失败',
  anomaly: '异常',
};
export const messageQuerySchema = z.strictObject({
  type: z.preprocess((v) => (v === '' ? undefined : v), messageTypeSchema.optional()),
  unread: z.preprocess(
    (v) => (v === '' ? undefined : v),
    z
      .enum(['true', 'false'])
      .transform((v) => v === 'true')
      .optional(),
  ),
  page: z.coerce.number().int().min(1).max(MESSAGES.maxPage).default(1),
});
export type MessageQuery = z.infer<typeof messageQuerySchema>;
export const messageSchema = z.object({
  id: z.uuid(),
  type: messageTypeSchema,
  title: z.string(),
  body: z.string(),
  linkPath: z.string().regex(/^\/(?:inbound\/|outbound\/|stocktakes\/|catalog$|maintenance$|stock(?:\?|$))/),
  createdAt: z.iso.datetime(),
  readAt: z.iso.datetime().nullable(),
  resolvedAt: z.iso.datetime().nullable(),
});
export type SystemMessage = z.infer<typeof messageSchema>;
export const unreadCountSchema = z.object({ unreadCount: z.number().int().nonnegative() });
export const messageListSchema = unreadCountSchema.extend({
  items: z.array(messageSchema),
  total: z.number().int().nonnegative(),
  page: z.number().int().positive(),
  pageSize: z.literal(MESSAGES.pageSize),
});
export const messageScanSchema = z.object({
  at: z.iso.datetime().nullable(),
  status: z.enum(['unknown', 'succeeded', 'failed', 'running', 'interrupted']),
  reason: z.string().nullable(),
});
export type MessageScan = z.infer<typeof messageScanSchema>;
