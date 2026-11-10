import { z } from 'zod';

export const masterCatalogSchema = z.enum(['products', 'categories', 'warehouses', 'customers', 'suppliers']);
const optionalText = (max: number) => z.string().trim().max(max).nullable().optional();
export const masterEditableFields = {
  model: optionalText(200),
  categoryCode: z.string().trim().min(1).max(64).nullable().optional(),
  packageType: optionalText(100),
  packageColor: optionalText(100),
  strapColor: optionalText(100),
  minAlertTonnes: z.number().nonnegative().max(99_999_999).multipleOf(0.0001).nullable().optional(),
  maxAlertTonnes: z.number().nonnegative().max(99_999_999).multipleOf(0.0001).nullable().optional(),
  contact: optionalText(100),
  phone: optionalText(50),
  address: optionalText(500),
  memo: optionalText(500),
};
export const masterItemSchema = z.object({
  code: z.string().min(1).max(64),
  name: z.string().min(1).max(200),
  active: z.boolean(),
  ...masterEditableFields,
  originKind: z.enum(['local', 'legacy', 'unknown']).optional(),
  inventoryEligible: z.boolean().optional(),
});
export const masterItemsSchema = z.array(masterItemSchema);
export const masterListQuerySchema = z.strictObject({
  page: z.coerce.number().int().min(1).max(1_000_000).default(1),
  pageSize: z.coerce.number().int().min(1).max(200).default(20),
  keyword: z.string().trim().max(200).default(''),
  status: z.enum(['all', 'active', 'inactive']).default('all'),
  scope: z.literal('inventory').optional(),
});
export const masterPageSchema = z.object({
  items: masterItemsSchema,
  total: z.number().int().nonnegative(),
  page: z.number().int().positive(),
  pageSize: z.number().int().positive(),
});
export type MasterListQuery = z.infer<typeof masterListQuerySchema>;
export const createMasterItemSchema = z.strictObject({
  ...masterEditableFields,
  code: z
    .string()
    .trim()
    .min(1)
    .max(64)
    .regex(/^[a-zA-Z0-9_-]+$/),
  name: z.string().trim().min(1).max(200),
});
export const updateMasterItemSchema = z
  .strictObject({
    ...masterEditableFields,
    name: z.string().trim().min(1).max(200).optional(),
    active: z.boolean().optional(),
  })
  .refine((input) => Object.keys(input).length > 0, '至少提供一个修改字段');
export type CreateMasterItem = z.infer<typeof createMasterItemSchema>;
export type UpdateMasterItem = z.infer<typeof updateMasterItemSchema>;
export type MasterCatalog = z.infer<typeof masterCatalogSchema>;
export type MasterItem = z.infer<typeof masterItemSchema>;
