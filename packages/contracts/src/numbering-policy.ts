export const DOCUMENT_NUMBER_WIDTH = 3;
export const DOCUMENT_NUMBER_CAPACITY = 999;
export const NUMBER_CAPACITY_MESSAGE = '编号容量已用尽，需计划重编';
export const MASTER_CODE_RULES = {
  customers: { prefix: 'C', width: 5, capacity: 99_999 },
  suppliers: { prefix: 'S', width: 4, capacity: 9_999 },
  warehouses: { prefix: 'W', width: 2, capacity: 99 },
} as const;
export type GeneratedMasterCatalog = keyof typeof MASTER_CODE_RULES;
export function hasGeneratedMasterCode(catalog: string): catalog is GeneratedMasterCatalog {
  return Object.hasOwn(MASTER_CODE_RULES, catalog);
}
