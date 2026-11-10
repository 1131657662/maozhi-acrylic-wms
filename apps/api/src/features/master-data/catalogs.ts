import { masterCatalogSchema, type MasterCatalog } from '@wms/contracts';
import type { Database } from '../../db/mysql.ts';
import { ensure } from '../../shared/errors.ts';

const labels: Record<MasterCatalog, string> = {
  products: '商品',
  categories: '分类',
  warehouses: '仓库',
  customers: '客户',
  suppliers: '供应商',
};
const tables: Record<MasterCatalog, string> = {
  products: 'master_products',
  categories: 'master_product_categories',
  warehouses: 'master_warehouses',
  customers: 'master_customers',
  suppliers: 'master_suppliers',
};
export function parseCatalog(value: unknown): MasterCatalog {
  return masterCatalogSchema.parse(value);
}
export async function activeMaster(
  db: Database,
  catalog: MasterCatalog,
  code: string,
): Promise<{ code: string; name: string; active: true }> {
  const row = await db.get(
    `SELECT code,name,active FROM ${tables[catalog]} WHERE code=? AND source_del_flag=0 FOR SHARE`,
    [code],
  );
  ensure(row && Number(row.active) === 1, 'MASTER_DATA_INACTIVE', `${labels[catalog]}不存在或已停用`);
  return { code: String(row.code), name: String(row.name), active: true };
}
export function catalogTable(catalog: MasterCatalog): string {
  return tables[parseCatalog(catalog)];
}
