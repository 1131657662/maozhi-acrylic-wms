import { z } from 'zod';

const codeSchema = z.string().min(1).max(64).regex(/^[a-zA-Z0-9_-]+$/);
const gramsSchema = z.number().int().positive().max(99_999_999_999_900).multipleOf(100);

export const inboundLineInputSchema = z.strictObject({
  productCode: codeSchema,
  packages: z.number().int().positive().max(1_000_000),
  weightGrams: gramsSchema,
});
export const createInboundSchema = z.strictObject({
  receiptNo: z.string().trim().min(1).max(100).optional(),
  supplierCode: codeSchema,
  warehouseCode: codeSchema,
  memo: z.string().trim().max(500).optional(),
  lines: z.array(inboundLineInputSchema).min(1).max(50)
    .refine((lines) => new Set(lines.map((line) => line.productCode)).size === lines.length, '商品不能重复'),
});
export const inboundLineSchema = inboundLineInputSchema.extend({ id: codeSchema, productName: z.string() });
export const inboundReceiptSchema = z.object({
  id: codeSchema,
  receiptNo: z.string(),
  status: z.string().nullable().default(null),
  supplierCode: codeSchema,
  supplierName: z.string(),
  warehouseCode: codeSchema,
  warehouseName: z.string(),
  memo: z.string().nullable(),
  createdBy: z.string(),
  createdAt: z.string(),
  packages: z.number().int(),
  weightGrams: z.number().int(),
  lines: z.array(inboundLineSchema),
});
export const inboundListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).max(10000).default(1),
  pageSize: z.coerce.number().int().min(1).max(50).default(10),
  keyword: z.string().max(50).default(''),
});
export const inboundListSchema = z.object({
  items: z.array(inboundReceiptSchema),
  total: z.number().int(),
  page: z.number().int(),
  pageSize: z.number().int(),
});
export type CreateInbound = z.infer<typeof createInboundSchema>;
export type InboundReceipt = z.infer<typeof inboundReceiptSchema>;
