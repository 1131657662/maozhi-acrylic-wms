import { z } from 'zod';
import { catalogVersionId } from './catalog.ts';
import { catalogSearchQuerySchema, CATALOG_BARCODE_MAX_LENGTH } from './catalog-query.ts';

export const CATALOG_ERROR_MAX_ROWS = 500;
export const CATALOG_ERROR_LINE_MAX_LENGTH = 200;
export const CATALOG_DIFF_PAGE_SIZE = 50;
export const CATALOG_READ_BATCH_SIZE = 1000;
export const CATALOG_UPLOAD_MAX_BYTES = 5 * 1024 * 1024;
export const CATALOG_UPLOAD_MAX_ROWS = 100_000;
export const catalogDiffQuerySchema = z.object({
  against: z.coerce.number().pipe(catalogVersionId).optional(),
  kind: z.enum(['all', 'added', 'removed', 'weight', 'spec', 'unchanged', 'changed']).default('all'),
  afterBarcode: z.string().max(CATALOG_BARCODE_MAX_LENGTH).default(''),
  limit: z.coerce.number().int().min(1).max(CATALOG_READ_BATCH_SIZE).default(CATALOG_DIFF_PAGE_SIZE),
});
export const catalogExportQuerySchema = catalogSearchQuerySchema.pick({ q: true }).extend({
  versionId: z.coerce.number().pipe(catalogVersionId),
});
export const catalogUploadErrorsSchema = z.object({
  errors: z
    .array(
      z.object({
        line: z.number().int().positive(),
        raw: z.string().max(CATALOG_ERROR_LINE_MAX_LENGTH * 2),
        reason: z.string(),
      }),
    )
    .max(CATALOG_ERROR_MAX_ROWS),
  truncated: z.boolean(),
});
export type CatalogDiffQuery = z.infer<typeof catalogDiffQuerySchema>;
export type CatalogExportQuery = z.infer<typeof catalogExportQuerySchema>;
export type CatalogUploadErrors = z.infer<typeof catalogUploadErrorsSchema>;

export const catalogExportCopy = {
  barcode: '条码',
  spec: '规格',
  weight: '重量（千克）',
  version: '版本',
  noSpec: '未填写规格',
  versionLabel: (id: number) => `第 ${id} 版`,
  tooManyErrors: '错误过多，仅显示前 500 条',
  line: '行号',
  raw: '原始行内容',
  reason: '原因',
};
