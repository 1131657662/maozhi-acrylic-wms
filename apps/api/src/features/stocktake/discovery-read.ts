import { discoverySchema, discoveryMetadataSchema, type StocktakeQuery } from '@wms/contracts';
import type { Database, Row } from '../../db/mysql.ts';
import { isoDate } from '../../db/dates.ts';

export const discoverySelect = `SELECT d.*,p.name AS product_name FROM stocktake_discovery_lines d
 JOIN master_products p ON p.code=d.product_code`;
export function discovery(row: Row) {
  return discoverySchema.parse({
    id: row.id,
    stocktakeId: row.stocktake_id,
    warehouseCode: row.warehouse_code,
    productCode: row.product_code,
    productName: row.product_name,
    packages: Number(row.packages),
    weightGrams: Number(row.weight_grams),
    reason: row.reason,
    actor: row.actor,
    version: Number(row.version),
    createdAt: isoDate(row.created_at),
    updatedAt: isoDate(row.updated_at),
  });
}
export function discoveryMetadata(row: Row) {
  if (!row.discovery_id) return undefined;
  return discoveryMetadataSchema.parse({
    id: row.discovery_id,
    version: Number(row.revision),
    reason: row.reason,
    actor: row.actor,
    createdAt: isoDate(row.created_at),
    updatedAt: isoDate(row.updated_at),
  });
}
export async function discoveryPage(db: Database, id: string, query: StocktakeQuery) {
  const filter = 'd.stocktake_id=? AND (d.product_code LIKE ? OR p.name LIKE ?)';
  const values = [id, `%${query.keyword}%`, `%${query.keyword}%`];
  const from = 'FROM stocktake_discovery_lines d JOIN master_products p ON p.code=d.product_code';
  const count = await db.get(`SELECT COUNT(*) AS n ${from} WHERE ${filter}`, values);
  const rows = await db.all(`${discoverySelect} WHERE ${filter} ORDER BY d.product_code LIMIT ? OFFSET ?`, [
    ...values,
    query.pageSize,
    (query.page - 1) * query.pageSize,
  ]);
  return { items: rows.map(discovery), total: Number(count?.n ?? 0) };
}
export const discoveryTotals = `SELECT stocktake_id,COUNT(*) AS discovery_count,
 SUM(packages) AS discovery_packages,SUM(weight_grams) AS discovery_grams,
 SUM(IF(packages<>0 OR weight_grams<>0,1,0)) AS discovery_changed
 FROM stocktake_discovery_lines GROUP BY stocktake_id`;
