import { z } from 'zod';
import { scanContextInputSchema } from './scan-context.ts';

const sha = z.string().regex(/^[a-f0-9]{64}$/);
export const handoffStartSchema = z.strictObject({
  id: z.uuid(),
  deviceId: z.string().min(1).max(80),
  appVersion: z.string().min(1).max(80),
  expectedCount: z.number().int().min(0).max(100000),
  manifestSha: sha,
  catalogVersion: z.number().int().positive(),
  catalogSha: sha,
  previousSessionHashes: z.array(sha).max(20).default([]),
});
export const handoffRecordInputSchema = z.strictObject({
  planId: z.string().min(1).max(80),
  rawPayload: z.string().min(2).max(2048),
  payloadSha: sha,
  localState: z.enum(['pending', 'failed', 'conflict', 'synced']),
  context: scanContextInputSchema.optional(),
});
export const handoffBatchSchema = z.strictObject({ records: z.array(handoffRecordInputSchema).min(1).max(3) });
export const handoffBindSchema = z.strictObject({
  factIds: z.array(z.uuid()).min(1).max(100),
  outboundLineId: z.string().min(1).max(64),
});
export const handoffSummarySchema = z.object({
  id: z.string(),
  deviceId: z.string(),
  appVersion: z.string(),
  expectedCount: z.number(),
  registered: z.number(),
  received: z.number(),
  unresolved: z.number(),
  missingContext: z.number(),
  manifestValid: z.boolean(),
  catalogVersion: z.number(),
  confirmedAt: z.string().nullable(),
  ready: z.boolean(),
  reasons: z.array(z.string()),
});
export const handoffRecordSchema = z.object({
  factId: z.string(),
  planId: z.string(),
  barcode: z.string(),
  catalogVersion: z.number(),
  weightGrams: z.number(),
  localState: z.string(),
  received: z.boolean(),
  payloadMatches: z.boolean(),
  context: z
    .object({
      outboundLineId: z.string(),
      sourceSpec: z.string().nullable(),
      resolvedAt: z.string().nullable(),
    })
    .nullable(),
});
export const handoffDetailSchema = z.object({
  summary: handoffSummarySchema,
  items: z.array(handoffRecordSchema),
  total: z.number(),
});
export const handoffOverviewSchema = z.object({
  devices: z.array(handoffSummarySchema),
  clients: z.array(z.object({ clientKey: z.string(), requests: z.number(), lastSeen: z.string() })),
});
export type HandoffStart = z.infer<typeof handoffStartSchema>;
export type HandoffRecordInput = z.infer<typeof handoffRecordInputSchema>;
