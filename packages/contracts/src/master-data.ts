import { z } from 'zod';

export const masterCatalogSchema = z.enum(['products', 'warehouses', 'customers', 'suppliers']);
export const masterItemSchema = z.object({
  code: z.string().min(1).max(64),
  name: z.string().min(1).max(200),
  active: z.boolean(),
});
export const masterItemsSchema = z.array(masterItemSchema);
export const masterListQuerySchema = z.strictObject({
  page: z.coerce.number().int().min(1).max(1_000_000).default(1),
  pageSize: z.coerce.number().int().min(1).max(200).default(20),
  keyword: z.string().trim().max(200).default(''),
  status: z.enum(['all', 'active', 'inactive']).default('all'),
});
export const masterPageSchema = z.object({
  items: masterItemsSchema,
  total: z.number().int().nonnegative(),
  page: z.number().int().positive(),
  pageSize: z.number().int().positive(),
});
export type MasterListQuery = z.infer<typeof masterListQuerySchema>;
export const createMasterItemSchema = z.strictObject({
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
    name: z.string().trim().min(1).max(200).optional(),
    active: z.boolean().optional(),
  })
  .refine((input) => input.name !== undefined || input.active !== undefined, '至少提供一个修改字段');
export type MasterCatalog = z.infer<typeof masterCatalogSchema>;
export type MasterItem = z.infer<typeof masterItemSchema>;
