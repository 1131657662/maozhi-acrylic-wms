import { z } from 'zod';
import { stocktakeSchema, stocktakeLineSchema, stocktakePreviewSchema } from './stocktake.ts';
import { discoveryListSchema } from './stocktake-discovery.ts';

export const hiddenStocktakeSchema = stocktakeSchema
  .pick({
    id: true,
    number: true,
    warehouseCode: true,
    warehouseName: true,
    scope: true,
    mode: true,
    revealedAt: true,
    status: true,
    snapshotAt: true,
    revision: true,
    lineCount: true,
    recordedCount: true,
    createdBy: true,
    closedAt: true,
    closeReason: true,
    operationId: true,
    actualPackages: true,
    actualWeightGrams: true,
  })
  .extend({ visibility: z.literal('hidden'), mode: z.literal('blind'), revealedAt: z.null() });
export const visibleStocktakeSchema = stocktakeSchema.extend({ visibility: z.literal('visible') });
export const publicStocktakeSchema = z.discriminatedUnion('visibility', [
  hiddenStocktakeSchema,
  visibleStocktakeSchema,
]);
export const hiddenStocktakeLineSchema = stocktakeLineSchema
  .pick({
    productCode: true,
    discovery: true,
    productName: true,
    actual: true,
    revision: true,
  })
  .extend({ visibility: z.literal('hidden') });
export const visibleStocktakeLineSchema = stocktakeLineSchema.extend({ visibility: z.literal('visible') });
export const publicStocktakeLineSchema = z.discriminatedUnion('visibility', [
  hiddenStocktakeLineSchema,
  visibleStocktakeLineSchema,
]);
export const publicStocktakeListSchema = z.object({ items: z.array(publicStocktakeSchema), total: z.number().int() });
export const publicStocktakeLinesSchema = z.object({
  items: z.array(publicStocktakeLineSchema),
  total: z.number().int(),
});
export const publicStocktakePreviewSchema = stocktakePreviewSchema.extend({ stocktake: visibleStocktakeSchema });
export const publicStocktakeDetailSchema = z.discriminatedUnion('visibility', [
  hiddenStocktakeSchema.extend({ discoveries: discoveryListSchema }),
  visibleStocktakeSchema.extend({ discoveries: discoveryListSchema }),
]);
export const revealStocktakeSchema = z.strictObject({ expectedRevision: z.number().int().nonnegative() });
export const stocktakeExportQuerySchema = z.strictObject({ kind: z.enum(['blank', 'result']).default('result') });
export const STOCKTAKE_EXPORT_PAGE_SIZE = 200;
export type PublicStocktake = z.infer<typeof publicStocktakeSchema>;
export type PublicStocktakeLine = z.infer<typeof publicStocktakeLineSchema>;
export type PublicStocktakePreview = z.infer<typeof publicStocktakePreviewSchema>;
