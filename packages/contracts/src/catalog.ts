import { z } from 'zod';

export const catalogVersionId = z.number().int().positive().max(2_147_483_647);
export const catalogEntrySchema = z.object({
  barcode: z.string(),
  sourceSpec: z.string().nullable(),
  weightGrams: z.number().int().positive(),
  catalogVersion: catalogVersionId,
});
export const catalogDiffCountsSchema = z.object({
  added: z.number().int(),
  removed: z.number().int(),
  weight: z.number().int(),
  spec: z.number().int(),
  changed: z.number().int(),
  unchanged: z.number().int(),
});
export const catalogVersionSchema = z.object({
  versionId: catalogVersionId,
  uploadId: z.string(),
  status: z.enum(['validated', 'published']),
  baseVersionId: catalogVersionId.nullable(),
  baseRevision: z.number().int(),
  contentSha256: z.string(),
  sourceSha256: z.string(),
  entryCount: z.number().int(),
  specCount: z.number().int(),
  sourceName: z.string(),
  createdAt: z.string(),
  publishedAt: z.string().nullable(),
  diffCounts: catalogDiffCountsSchema,
});
export const catalogUploadResultSchema = z.object({
  uploadId: z.string(),
  duplicate: z.boolean(),
  matchedVersionId: catalogVersionId.nullable(),
  message: z.string(),
  version: catalogVersionSchema.nullable(),
});
export const catalogGateSchema = z.object({
  allowed: z.boolean(),
  reasons: z.array(z.string()),
  legacyRequests: z.number().int(),
  unverifiedClients: z.number().int(),
});
export const catalogOverviewSchema = z.object({
  current: catalogVersionSchema.nullable(),
  revision: z.number().int(),
  gate: catalogGateSchema,
});
export const catalogPublishInputSchema = z.strictObject({
  baseRevision: z.number().int().nonnegative(),
  contentSha256: z.string().regex(/^[a-f0-9]{64}$/),
});
export const catalogPublishResultSchema = z.object({
  activeVersion: catalogVersionId,
  revision: z.number().int(),
  operationId: z.string(),
  publishedAt: z.string(),
});
export const catalogDiffRowSchema = z.object({
  barcode: z.string(),
  kind: z.enum(['added', 'removed', 'changed', 'unchanged']),
  oldSpec: z.string().nullable(),
  newSpec: z.string().nullable(),
  oldWeightGrams: z.number().nullable(),
  newWeightGrams: z.number().nullable(),
  weightChanged: z.boolean(),
  specChanged: z.boolean(),
});
export const catalogDiffPageSchema = z.object({
  items: z.array(catalogDiffRowSchema),
  total: z.number(),
  baseVersionId: catalogVersionId.nullable(),
});
export const catalogHistorySchema = z.object({ items: z.array(catalogVersionSchema), total: z.number() });
export const catalogEntryPageSchema = z.object({
  items: z.array(catalogEntrySchema),
  nextBarcode: z.string().nullable(),
  versionId: catalogVersionId,
  contentSha256: z.string(),
  entryCount: z.number(),
});
export type CatalogVersion = z.infer<typeof catalogVersionSchema>;
export type CatalogDiffRow = z.infer<typeof catalogDiffRowSchema>;
export type CatalogUploadResult = z.infer<typeof catalogUploadResultSchema>;
