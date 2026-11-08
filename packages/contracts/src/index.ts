import { z } from 'zod';
export * from './document-numbering.ts';
export * from './stock-journal.ts';
export * from './master-data.ts';
export * from './inbound.ts';
export * from './outbound-plan.ts';

export const idSchema = z
  .string()
  .min(1)
  .max(64)
  .regex(/^[a-zA-Z0-9_-]+$/);
export const gramsSchema = z.number().int().positive().max(1_000_000_000).multipleOf(100);
export const statusSchema = z.string().max(32);
export const channelSchema = z.enum(['web', 'pda', 'miniapp']);
export const loginSchema = z.strictObject({
  username: z.string().min(1).max(64),
  password: z.string().min(1).max(128),
  channel: channelSchema,
});
export const listQuerySchema = z.object({
  page: z.coerce.number().int().min(1).max(10000).default(1),
  pageSize: z.coerce.number().int().min(1).max(50).default(10),
  status: statusSchema.optional(),
  keyword: z.string().max(50).default(''),
});
export const lineSchema = z.object({
  id: idSchema,
  productCode: idSchema,
  productName: z.string(),
  plannedPackages: z.number().int(),
  plannedWeightGrams: gramsSchema,
  actualPackages: z.number().int(),
  actualWeightGrams: z.number().int(),
});
export const factInputSchema = z.strictObject({
  id: z.uuid(),
  barcode: idSchema,
  weightGrams: gramsSchema,
  catalogVersion: z.literal(1),
  weightSource: z.literal('catalog'),
  deviceId: idSchema,
  scannedAt: z.iso.datetime(),
  planVersion: z.literal(1),
});
export const factSchema = factInputSchema.extend({ planId: idSchema, recordedBy: z.string(), receivedAt: z.string() });
export const orderSchema = z.object({
  id: idSchema,
  orderNo: z.string(),
  customerName: z.string(),
  customerCode: idSchema,
  warehouseCode: z.string(),
  vehicleNo: z.string(),
  status: statusSchema,
  revision: z.number().int(),
  planVersion: z.literal(1),
  createdAt: z.string(),
  plannedPackages: z.number().int(),
  plannedWeightGrams: z.number().int(),
  actualPackages: z.number().int(),
  actualWeightGrams: z.number().int(),
});
export const detailSchema = orderSchema.extend({
  lines: z.array(lineSchema),
  facts: z.array(factSchema),
  digest: z.string(),
});
export const listSchema = z.object({
  items: z.array(orderSchema),
  total: z.number().int(),
  page: z.number().int(),
  pageSize: z.number().int(),
});
export const revisionSchema = z.strictObject({
  revision: z.number().int().nonnegative(),
  digest: z.string().regex(/^[a-f0-9]{64}$/),
});
export const catalogItemSchema = z.object({
  barcode: idSchema,
  productCode: idSchema,
  weightGrams: gramsSchema,
  catalogVersion: z.literal(1),
});
export const catalogSchema = z.array(catalogItemSchema);
export const stockSchema = z.array(
  z.object({
    warehouseCode: z.string(),
    productCode: z.string(),
    packages: z.number().int(),
    weightGrams: z.number().int(),
  }),
);
export const sessionSchema = z.object({ username: z.string(), channel: channelSchema });
export const loginResultSchema = sessionSchema.extend({ token: z.string().optional() });
export const auditSchema = z.array(
  z.object({
    id: z.number(),
    action: z.string(),
    targetId: z.string(),
    actor: z.string(),
    traceId: z.string(),
    createdAt: z.string(),
    beforeJson: z.string(),
    afterJson: z.string(),
  }),
);
export type Order = z.infer<typeof orderSchema>;
export type Detail = z.infer<typeof detailSchema>;
export type FactInput = z.infer<typeof factInputSchema>;
export type ListQuery = z.infer<typeof listQuerySchema>;
export type Session = z.infer<typeof sessionSchema>;
export type Revision = z.infer<typeof revisionSchema>;

export function tonnes(grams: number): string {
  return (grams / 1_000_000).toFixed(4);
}
