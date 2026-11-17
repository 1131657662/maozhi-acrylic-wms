import { z } from 'zod';
import { maintenanceJobSchema } from './maintenance.ts';

export const RESTORE = {
  sampleDocuments: 5,
  fingerprintPage: 500,
  randomBytes: 12,
  passwordBytes: 32,
  lockWaitSeconds: 5,
  importTimeoutMs: 1800000,
  maximumSqlLineBytes: 16777216,
  diagnosticBytes: 512,
} as const;
export const restoreStageSchema = z.enum(['backup', 'provision', 'import', 'verify', 'report']);
export const restoreRequestSchema = z.strictObject({ artifactId: z.uuid(), confirmation: z.literal('RECOVER') });
export const verificationItemSchema = z.object({
  label: z.string(),
  expected: z.string().nullable(),
  actual: z.string().nullable(),
  difference: z.string(),
  conclusion: z.enum(['passed', 'mismatch', 'unverified']),
});
export const restoreReportSchema = z.object({
  outcome: z.enum(['passed', 'limited', 'mismatch', 'failed', 'interrupted']),
  baselineAt: z.iso.datetime().nullable(),
  verifiedAt: z.iso.datetime().nullable(),
  items: z.array(verificationItemSchema),
});
export const restoreEvidenceSchema = z.array(
  z.object({
    at: z.iso.datetime(),
    stage: restoreStageSchema,
    message: z.string(),
  }),
);
export const restoreDetailSchema = z.object({
  job: maintenanceJobSchema,
  stage: restoreStageSchema,
  report: restoreReportSchema.nullable(),
  evidence: restoreEvidenceSchema,
  databaseRetained: z.boolean(),
  accountLocked: z.boolean(),
});
export type RestoreRequest = z.infer<typeof restoreRequestSchema>;
export type RestoreStage = z.infer<typeof restoreStageSchema>;
export type RestoreReport = z.infer<typeof restoreReportSchema>;
export type RestoreDetail = z.infer<typeof restoreDetailSchema>;
export type VerificationItem = z.infer<typeof verificationItemSchema>;
