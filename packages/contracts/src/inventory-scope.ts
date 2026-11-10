import { z } from 'zod';
export const inventoryScopeFields = {
  source: z.literal('erp-product').optional(),
  scope: z.literal('inventory').optional(),
};
export function validInventoryScope(value: { source?: string; scope?: string }): boolean {
  return (value.source !== undefined) !== (value.scope !== undefined);
}
export const inventoryScopeResult = z.enum(['erp-product', 'inventory']);
