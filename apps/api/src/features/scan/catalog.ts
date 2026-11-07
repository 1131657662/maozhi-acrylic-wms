import { catalogItemSchema, catalogSchema } from '@wms/contracts';
import type { Database,Row } from '../../db/mysql.ts';
import { decimalToGrams } from '../../db/weight.ts';
export const catalogSql = `SELECT barcode,product_code AS productCode,weight_tonnes AS weightGrams,
  catalog_version AS catalogVersion FROM scan_catalog`;
export function catalogItem(row: Row) {
  return catalogItemSchema.parse({
    ...row,
    catalogVersion: Number(row.catalogVersion),
    weightGrams: decimalToGrams(row.weightGrams),
  });
}
export async function listCatalog(db: Database) {
  return catalogSchema.parse((await db.all(`${catalogSql} ORDER BY barcode`)).map(catalogItem));
}
