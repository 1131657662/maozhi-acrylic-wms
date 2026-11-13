import { z } from 'zod';
import { scanContextInputSchema } from './scan-context.ts';
import { plannedWeightGramsSchema } from './outbound-plan.ts';
import { correctionSummarySchema } from './corrections.ts';
import { scanSourceSchema, scanAttributionSchema } from './scan-workbench.ts';
export * from './scan-workbench.ts';
export * from './outbound-shipments.ts';
export * from './business-date.ts';
export * from './date-corrections.ts';
export * from './document-types.ts';
export * from './corrections.ts';
export * from './catalog.ts';
export * from './catalog-query.ts';
export * from './scan-context.ts';
export * from './handoff.ts';
export * from './inventory-posting.ts';
export * from './document-numbering.ts';
export * from './stock-journal.ts';
export * from './stock-source.ts';
export * from './master-data.ts';
export * from './party-contacts.ts';
export * from './vehicles.ts';
export * from './snapshots.ts';
export * from './inbound.ts';
export * from './outbound-plan.ts';
export * from './outbound-actual.ts';

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
  productModel: z.string().nullable().optional(),
  packageType: z.string().nullable().optional(),
  contractNo: z.string().nullable().default(null),
  memo: z.string().nullable().default(null),
  plannedPackages: z.number().int(),
  plannedWeightGrams: plannedWeightGramsSchema,
  scanPackages: z.number().int().nullable().default(null),
  scanWeightGrams: z.number().int().nullable().default(null),
  actualPackages: z.number().int(),
  actualWeightGrams: z.number().int(),
});
export const factInputSchema = z.strictObject({
  id: z.uuid(),
  barcode: idSchema,
  weightGrams: gramsSchema,
  catalogVersion: z.number().int().positive().max(2_147_483_647),
  weightSource: z.literal('catalog'),
  deviceId: idSchema,
  scannedAt: z.iso.datetime(),
  planVersion: z.literal(1),
});
export const factSchema = factInputSchema.extend({
  source: scanSourceSchema.nullable().optional(),
  attribution: scanAttributionSchema.nullable().optional(),
  planId: idSchema,
  recordedBy: z.string(),
  receivedAt: z.string(),
  productCode: z.string().optional(),
  productName: z.string().optional(),
});
export const scanRequestSchema = z.union([
  factInputSchema.extend({ catalogVersion: z.literal(1) }),
  z.strictObject({ schemaVersion: z.literal(2), fact: factInputSchema, context: scanContextInputSchema }),
]);
export const orderSchema = z.object({
  id: idSchema,
  orderNo: z.string(),
  customerName: z.string(),
  customerCode: idSchema,
  warehouseCode: z.string(),
  warehouseName: z.string().nullable().optional(),
  contactId: z.uuid().nullable().optional(),
  shipToName: z.string().nullable().optional(),
  shipToPhone: z.string().nullable().optional(),
  shipToAddress: z.string().nullable().optional(),
  billType: z.enum(['sales', 'sample', 'return', 'other']).nullable().default(null),
  containerNo: z.string().nullable().default(null),
  vehicleId: z.uuid().nullable().optional(),
  vehicleNo: z.string(),
  memo: z.string().max(500).nullable().default(null),
  status: statusSchema,
  scanClosedAt: z.string().nullable().default(null),
  revision: z.number().int(),
  planVersion: z.literal(1),
  createdAt: z.string(),
  businessDate: z.string().nullable().default(null),
  effectiveBusinessDate: z.string().nullable().default(null),
  plannedPackages: z.number().int(),
  plannedWeightGrams: z.number().int(),
  scanPackages: z.number().int().nullable().default(null),
  scanWeightGrams: z.number().int().nullable().default(null),
  actualPackages: z.number().int(),
  actualWeightGrams: z.number().int(),
});
export const detailSchema = orderSchema.extend({
  corrections: correctionSummarySchema.nullable().default(null),
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
export { auditRowSchema } from './audit.ts';
import { auditRowSchema } from './audit.ts';
export const auditSchema = z.array(auditRowSchema);
export * from './audit.ts';
export * from './audit-registry.ts';
export type Order = z.infer<typeof orderSchema>;
export type Detail = z.infer<typeof detailSchema>;
export type FactInput = z.infer<typeof factInputSchema>;
export type ListQuery = z.infer<typeof listQuerySchema>;
export type Session = z.infer<typeof sessionSchema>;
export type Revision = z.infer<typeof revisionSchema>;

export function tonnes(grams: number): string {
  return (grams / 1_000_000).toFixed(4);
}
export * from './web-list-query.ts';
export * from './web-list.ts';
export * from './list-display.ts';
export * from './web-export.ts';
export * from './document-lifecycle.ts';
export * from './stocktake.ts';
export * from './reports.ts';
export * from './report-reconciliation.ts';
export * from './export-kind.ts';
export * from './list-preferences.ts';
export * from './numbering-policy.ts';
export * from './business-labels.ts';
export * from './catalog-exports.ts';
export * from './catalog-candidates.ts';
