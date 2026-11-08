import { z } from 'zod';
import { exportKindSchema } from './export-kind.ts';

export const exportScopeSchema = z.enum(['all', 'page', 'selected']);
export const exportRequestSchema = z.strictObject({
  requestId: z.uuid(),
  kind: exportKindSchema,
  scope: exportScopeSchema,
  query: z.record(z.string().max(64), z.string().max(500)).refine((query) => Object.keys(query).length <= 16),
  columns: z.array(z.string().max(64)).min(1).max(64),
  viewToken: z.string().regex(/^[a-f0-9]{64}$/),
  selected: z.array(z.strictObject({ id: z.string().max(300), token: z.string().regex(/^[a-f0-9]{64}$/) })).max(5000),
});
export const exportJobSchema = z.strictObject({
  id: z.uuid(),
  kind: exportKindSchema,
  scope: exportScopeSchema,
  state: z.enum(['running', 'ready', 'failed', 'cancelled']),
  createdAt: z.string(),
  expiresAt: z.string(),
  processed: z.number().int(),
  total: z.number().int(),
  columns: z.array(z.strictObject({ key: z.string(), label: z.string() })),
  totals: z.record(z.string(), z.string()),
  preview: z.array(z.array(z.string())),
  error: z.string().nullable(),
  errorCode: z.string().nullable(),
  sha256: z.string().nullable(),
  bytes: z.number(),
  elapsedMs: z.number(),
  requestHash: z.string(),
});
export type ExportRequest = z.infer<typeof exportRequestSchema>;
export type ExportJob = z.infer<typeof exportJobSchema>;
