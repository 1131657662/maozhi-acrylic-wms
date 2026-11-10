import { z } from 'zod';
export const partyOwnerSchema = z.strictObject({
  partyType: z.enum(['customer', 'supplier']),
  partyCode: z.string().min(1).max(80),
});
const fields = {
  name: z.string().trim().min(1).max(100),
  phone: z.string().trim().max(50).nullable().optional(),
  address: z.string().trim().max(500).nullable().optional(),
};
export const createContactSchema = partyOwnerSchema.extend(fields);
export const updateContactSchema = z
  .strictObject({ ...fields, active: z.boolean() })
  .partial()
  .refine((value) => Object.keys(value).length > 0);
export const contactSchema = createContactSchema.extend({ id: z.uuid(), active: z.boolean(), isDefault: z.boolean() });
export const contactListSchema = z.object({ items: z.array(contactSchema), suggestedId: z.uuid().nullable() });
export type PartyOwner = z.infer<typeof partyOwnerSchema>;
export type Contact = z.infer<typeof contactSchema>;
