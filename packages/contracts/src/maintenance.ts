import { z } from 'zod';

export const MAINTENANCE = {
  listLimit: 20,
  maxLimit: 100,
  maxPage: 10000,
  pollMs: 2000,
  dayMs: 86400000,
  dailyDays: 30,
  monthlyMonths: 12,
  shanghaiOffsetMs: 28800000,
  dumpTimeoutMs: 1800000,
  minFreeBytes: 268435456,
  diskEstimateFactor: 2,
  recoveryDelayMs: 1000,
  maxRetentionItems: 10000,
  schedulerIntervalMs: 60000,
  schedulerHour: 3,
} as const;
export const maintenanceKindSchema = z.enum(['backup', 'restore']);
export const maintenanceStatusSchema = z.enum(['queued', 'running', 'succeeded', 'failed', 'interrupted']);
export const maintenanceJobSchema = z.object({
  id: z.uuid(),
  kind: maintenanceKindSchema,
  status: maintenanceStatusSchema,
  startedAt: z.iso.datetime(),
  finishedAt: z.iso.datetime().nullable(),
  operator: z.string(),
  error: z.string().nullable(),
  elapsedMs: z.number().nonnegative(),
});
export const maintenanceJobsQuerySchema = z.strictObject({
  kind: maintenanceKindSchema.optional(),
  limit: z.coerce.number().int().min(1).max(MAINTENANCE.maxLimit).default(MAINTENANCE.listLimit),
});
export const maintenancePageQuerySchema = z.strictObject({
  page: z.coerce.number().int().min(1).max(MAINTENANCE.maxPage).default(1),
  limit: z.coerce.number().int().min(1).max(MAINTENANCE.maxLimit).default(MAINTENANCE.listLimit),
});
export const backupArtifactSchema = z.object({
  id: z.uuid(),
  createdAt: z.iso.datetime(),
  bytes: z.number().int().positive(),
  sha256: z.string().regex(/^[0-9a-f]{64}$/),
  retentionClass: z.enum(['daily', 'monthly']),
  hasBaseline: z.boolean().default(false),
});
export const maintenanceJobsSchema = z.object({ items: z.array(maintenanceJobSchema) });
export const backupArtifactsSchema = z.object({
  items: z.array(backupArtifactSchema),
  total: z.number().int().nonnegative(),
});
export const backupAcceptedSchema = z.object({ jobId: z.uuid() });
export const retentionResultSchema = z.object({
  deleted: z.array(backupArtifactSchema),
  retained: z.number().int().nonnegative(),
  failures: z.array(z.object({ artifactId: z.uuid(), reason: z.string() })),
});
export type MaintenanceJob = z.infer<typeof maintenanceJobSchema>;
export type BackupArtifact = z.infer<typeof backupArtifactSchema>;
export type RetentionResult = z.infer<typeof retentionResultSchema>;
export type MaintenanceJobsQuery = z.infer<typeof maintenanceJobsQuerySchema>;
export type MaintenancePageQuery = z.infer<typeof maintenancePageQuerySchema>;
