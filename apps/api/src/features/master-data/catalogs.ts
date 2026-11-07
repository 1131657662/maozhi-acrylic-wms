import { masterCatalogSchema, type MasterCatalog } from '@wms/contracts';
import type { Database } from '../../db/mysql.ts';
import { ensure } from '../../shared/errors.ts';

const tables: Record<MasterCatalog, string> = {
  products: 'master_products',
  warehouses: 'master_warehouses',
  customers: 'master_customers',
  suppliers: 'master_suppliers',
};
export function parseCatalog(value: unknown): MasterCatalog {
  return masterCatalogSchema.parse(value);
}
export async function activeMaster(db: Database, catalog: MasterCatalog, code: string): Promise<{ code: string; name: string; active: true }> {
  const row = await db.get(`SELECT code,name,active FROM ${tables[catalog]} WHERE code=? FOR SHARE`, [code]);
  ensure(row && Number(row.active) === 1, 'MASTER_DATA_INACTIVE', `${catalog} 主数据不存在或已停用`);
  return { code: String(row.code), name: String(row.name), active: true };
}
export function catalogTable(catalog: MasterCatalog): string {
  return tables[parseCatalog(catalog)];
}
