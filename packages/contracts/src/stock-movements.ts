import { z } from 'zod';
import { journalSchema } from './stock-journal.ts';
import { WEB_LIST_PAGE_SIZES } from './list-display.ts';

export const STOCK_PEEK_MAX_PAIRS = 200;
export const STOCK_PEEK_LIMIT = 3;
export const STOCK_PEEK_BODY_LIMIT_BYTES = 256 * 1024;
export const STOCK_MOVEMENT_PAGE_SIZE = 20;
export const stockPairSchema = z.strictObject({
  warehouseCode: z.string().trim().min(1).max(80),
  productCode: z.string().trim().min(1).max(80),
});
export type StockPair = z.infer<typeof stockPairSchema>;
export const stockPairKey = (pair: StockPair): string => JSON.stringify([pair.warehouseCode, pair.productCode]);
export const stockPeekInputSchema = z
  .array(stockPairSchema)
  .min(1)
  .max(STOCK_PEEK_MAX_PAIRS)
  .refine((pairs) => new Set(pairs.map(stockPairKey)).size === pairs.length, '仓库商品组合不能重复');
export const stockMovementQuerySchema = stockPairSchema.partial().extend({
  page: z.coerce.number().int().min(1).max(1_000_000).default(1),
  pageSize: z.coerce
    .number()
    .int()
    .refine((n) => WEB_LIST_PAGE_SIZES.some((size) => size === n))
    .default(STOCK_MOVEMENT_PAGE_SIZE),
});
export const stockEvidenceSchema = z.strictObject({ href: z.string().startsWith('/stock/journal?') });
export const stockPeekRowSchema = journalSchema.element
  .pick({
    id: true,
    type: true,
    createdAt: true,
    packagesDelta: true,
    weightDeltaGrams: true,
  })
  .extend({ evidence: stockEvidenceSchema });
export const stockPeekSchema = z.array(
  stockPairSchema.extend({ items: z.array(stockPeekRowSchema).max(STOCK_PEEK_LIMIT) }),
);
export const stockMovementSchema = journalSchema.element.extend({
  productName: z.string().nullable(),
  warehouseName: z.string().nullable(),
  evidence: stockEvidenceSchema,
});
export const stockMovementPageSchema = z.strictObject({
  items: z.array(stockMovementSchema),
  total: z.number().int().nonnegative(),
  page: z.number().int().positive(),
  pageSize: z.number().int().positive(),
});
export type StockMovementQuery = z.infer<typeof stockMovementQuerySchema>;
export type StockMovement = z.infer<typeof stockMovementSchema>;
export type StockPeekRow = z.infer<typeof stockPeekRowSchema>;
