import { z } from 'zod';
import { maintenanceJobSchema } from './maintenance.ts';
export const maintenanceScheduleSchema = z.object({
  at: z.iso.datetime(),
  status: z.enum(['running', 'succeeded', 'failed', 'interrupted', 'skipped']),
  reason: z.string().nullable(),
});

export const maintenanceCheckSchema = z.object({
  status: z.enum(['ok', 'error', 'unsupported', 'pending']),
  checkedAt: z.iso.datetime(),
  source: z.string(),
  reason: z.string().nullable(),
});
export const maintenanceHealthSchema = z.object({
  database: maintenanceCheckSchema.extend({ latencyMs: z.number().nonnegative().nullable() }),
  disk: maintenanceCheckSchema.extend({ freeBytes: z.number().nonnegative().nullable() }),
  http: maintenanceCheckSchema.extend({
    windowHours: z.literal(24),
    requests: z.number().nullable(),
    errors: z.number().nullable(),
    p95Ms: z.number().nullable(),
  }),
  backup: maintenanceCheckSchema.extend({
    latest: maintenanceJobSchema.nullable(),
    lastSuccessAt: z.iso.datetime().nullable(),
    lastFailure: z.object({ at: z.iso.datetime(), reason: z.string() }).nullable(),
    latestSchedule: maintenanceScheduleSchema.nullable(),
  }),
});
export type MaintenanceHealth = z.infer<typeof maintenanceHealthSchema>;
export type MaintenanceCheck = z.infer<typeof maintenanceCheckSchema>;
