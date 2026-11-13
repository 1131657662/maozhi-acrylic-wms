import { z } from 'zod';
import { catalogVersionId } from './catalog.ts';

export const CATALOG_SEARCH_PAGE_SIZE_OPTIONS = [50, 100, 200] as const;
export const CATALOG_SEARCH_DEFAULT_PAGE_SIZE = 50;
export const CATALOG_SEARCH_MAX_PAGE = 2000;
export const CATALOG_SEARCH_MAX_QUERY_LENGTH = 255;
export const CATALOG_BARCODE_MAX_LENGTH = 80;

const pageSizeSchema = z.coerce
  .number()
  .int()
  .refine((value) => CATALOG_SEARCH_PAGE_SIZE_OPTIONS.some((size) => size === value));
const barcodeQuerySchema = z.string().trim().min(1).max(CATALOG_BARCODE_MAX_LENGTH);

export const catalogSearchQuerySchema = z.object({
  q: z.string().trim().max(CATALOG_SEARCH_MAX_QUERY_LENGTH).default(''),
  page: z.coerce.number().int().min(1).max(CATALOG_SEARCH_MAX_PAGE).default(1),
  pageSize: pageSizeSchema.default(CATALOG_SEARCH_DEFAULT_PAGE_SIZE),
});
export const catalogBarcodeQuerySchema = z.object({ barcode: barcodeQuerySchema });

export const catalogVersionContextSchema = z.object({
  versionId: catalogVersionId,
  status: z.literal('published'),
  revision: z.number().int().nonnegative(),
});
const catalogQueryEntrySchema = z.object({
  barcode: z.string(),
  sourceSpec: z.string().nullable(),
  weightGrams: z.number().int().positive().max(1_000_000_000).multipleOf(100),
});

export const catalogSearchResultSchema = z.object({
  version: catalogVersionContextSchema.nullable(),
  items: z.array(catalogQueryEntrySchema),
  total: z.number().int().nonnegative(),
  page: z.number().int().positive(),
  pageSize: pageSizeSchema,
});

const catalogSummaryWeightSchema = z.number().int().positive();
export const catalogSpecSummaryResultSchema = z.object({
  version: catalogVersionContextSchema.nullable(),
  items: z.array(
    z.object({
      sourceSpec: z.string().nullable(),
      barcodeCount: z.number().int().positive(),
      totalWeightGrams: catalogSummaryWeightSchema,
      minWeightGrams: catalogSummaryWeightSchema,
      maxWeightGrams: catalogSummaryWeightSchema,
      averageWeightGrams: catalogSummaryWeightSchema,
    }),
  ),
});

export const catalogBarcodeTraceResultSchema = z.object({
  barcode: z.string(),
  versions: z.array(
    z.object({
      versionId: catalogVersionId,
      status: z.enum(['validated', 'published']),
      sourceSpec: z.string().nullable(),
      weightGrams: catalogQueryEntrySchema.shape.weightGrams,
      createdAt: z.string(),
      publishedAt: z.string().nullable(),
    }),
  ),
  firstVersionId: catalogVersionId.nullable(),
  lastVersionId: catalogVersionId.nullable(),
});

export const catalogLookupResultSchema = z.discriminatedUnion('found', [
  z.object({
    found: z.literal(true),
    barcode: z.string(),
    version: catalogVersionContextSchema,
    entry: catalogQueryEntrySchema.pick({ sourceSpec: true, weightGrams: true }),
  }),
  z.object({
    found: z.literal(false),
    barcode: z.string(),
    version: catalogVersionContextSchema.nullable(),
    entry: z.null(),
  }),
]);

export type CatalogSearchQuery = z.infer<typeof catalogSearchQuerySchema>;
export type CatalogSearchResult = z.infer<typeof catalogSearchResultSchema>;
export type CatalogSpecSummaryResult = z.infer<typeof catalogSpecSummaryResultSchema>;
export type CatalogBarcodeTraceResult = z.infer<typeof catalogBarcodeTraceResultSchema>;
export type CatalogLookupResult = z.infer<typeof catalogLookupResultSchema>;
