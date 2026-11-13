import { z } from 'zod';

export const CATALOG_ABANDON_REASON_MAX = 500;
export const CATALOG_HANDOFF_PAGE_SIZE = 20;
export const CATALOG_HANDOFF_MAX_PAGE = 100000;
export const catalogCandidateCopy = {
  abandoned: '该候选已放弃，请重建候选',
  notAbandonable: '仅已校验未发布的候选可放弃',
  duplicateAbandoned: '内容相同的候选已放弃，如需重新处理请显式重建',
  reasonRequired: '请填写放弃原因',
  reasonTooLong: '放弃原因不能超过500字',
  baseChanged: '基准已变时拒绝发布，需重建候选',
};
export const catalogAbandonInputSchema = z.strictObject({
  reason: z
    .string()
    .trim()
    .min(1, catalogCandidateCopy.reasonRequired)
    .max(CATALOG_ABANDON_REASON_MAX, catalogCandidateCopy.reasonTooLong),
});
export const catalogAbandonmentSchema = z.object({
  reason: z.string(),
  actor: z.string(),
  createdAt: z.string(),
});
export const catalogAbandonResultSchema = z.object({
  versionId: z.number().int().positive(),
  operationId: z.uuid(),
  abandonment: catalogAbandonmentSchema,
});
export const catalogHandoffQuerySchema = z.object({
  page: z.coerce.number().int().positive().max(CATALOG_HANDOFF_MAX_PAGE).default(1),
});
export const catalogCandidateHandoffsSchema = z.object({
  baseVersionId: z.number().int().positive().nullable(),
  page: z.number().int().positive(),
  pageSize: z.number().int().positive(),
  total: z.number().int().nonnegative(),
  items: z.array(
    z.object({
      createdAt: z.string(),
      expectedCount: z.number(),
      registered: z.number(),
      received: z.number(),
      unresolved: z.number(),
      confirmedAt: z.string().nullable(),
    }),
  ),
});
