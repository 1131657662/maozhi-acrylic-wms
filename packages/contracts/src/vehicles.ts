import { z } from 'zod';
export function normalizePlate(value: string): string {
  return value.toUpperCase().replace(/[^\p{Script=Han}A-Z0-9]/gu, '');
}
export const plateSchema = z
  .string()
  .trim()
  .min(1)
  .max(100)
  .refine((value) => normalizePlate(value).length > 0, '车牌不能只有空白或符号');
const fields = {
  driver: z.string().trim().max(100).nullable().optional(),
  phone: z.string().trim().max(50).nullable().optional(),
  memo: z.string().trim().max(500).nullable().optional(),
};
export const createVehicleSchema = z.strictObject({ plate: plateSchema, ...fields });
export const updateVehicleSchema = z
  .strictObject({ ...fields, active: z.boolean().optional() })
  .refine((value) => Object.keys(value).length > 0);
export const vehicleSchema = z.object({
  id: z.uuid(),
  plate: z.string(),
  normalizedPlate: z.string(),
  ...fields,
  active: z.boolean(),
  source: z.enum(['auto', 'manual']),
  useCount: z.number().int(),
  lastUsedAt: z.string().nullable(),
});
export const vehiclePageSchema = z.object({
  items: z.array(vehicleSchema),
  total: z.number().int(),
  page: z.number().int(),
  pageSize: z.number().int(),
});
export type Vehicle = z.infer<typeof vehicleSchema>;
