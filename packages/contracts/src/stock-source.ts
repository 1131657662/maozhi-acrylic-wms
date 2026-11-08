import { z } from 'zod';
import { journalSchema } from './stock-journal.ts';

export const stockSourceSchema = z.enum(['erp-product', 'sku-spec', 'unclassified']);
export type StockSource = z.infer<typeof stockSourceSchema>;
export const stockSourceQuerySchema = z.strictObject({ source: stockSourceSchema });
export const sourceJournalQuerySchema = stockSourceQuerySchema.extend({
  limit: z.coerce.number().int().min(1).max(100).default(20),
});
const stockFields = {
  warehouseCode: z.string(),
  productCode: z.string(),
  productName: z.string().nullable(),
  sourceKind: z.string().nullable(),
  packages: z.number().int().safe(),
  weightGrams: z.number().int().safe(),
};
const subtotalSchema = z.strictObject({ packages: z.number().int().safe(), weightGrams: z.number().int().safe() });
function sourceStock<S extends StockSource>(source: S) {
  return z.strictObject({
    source: z.literal(source),
    items: z.array(z.strictObject({ ...stockFields, source: z.literal(source) })),
    subtotal: source === 'unclassified' ? z.null() : subtotalSchema,
  });
}
function sourceJournal<S extends StockSource>(source: S) {
  return z.strictObject({
    source: z.literal(source),
    items: z.array(journalSchema.element.extend({ source: z.literal(source) }).strict()),
  });
}
export const sourceStockSchema = z.discriminatedUnion('source', [
  sourceStock('erp-product'),
  sourceStock('sku-spec'),
  sourceStock('unclassified'),
]);
export const sourceJournalSchema = z.discriminatedUnion('source', [
  sourceJournal('erp-product'),
  sourceJournal('sku-spec'),
  sourceJournal('unclassified'),
]);
export type SourceStock = z.infer<typeof sourceStockSchema>;
export type SourceStockRow = SourceStock['items'][number];
export type SourceJournalRow = z.infer<typeof sourceJournalSchema>['items'][number];
