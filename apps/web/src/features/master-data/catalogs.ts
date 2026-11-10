import type { MasterCatalog } from '@wms/contracts';

export const masterCatalogs: { key: MasterCatalog; label: string }[] = [
  { key: 'products', label: '商品' },
  { key: 'categories', label: '分类' },
  { key: 'warehouses', label: '仓库' },
  { key: 'customers', label: '客户' },
  { key: 'suppliers', label: '供应商' },
];
