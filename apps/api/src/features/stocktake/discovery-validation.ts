import { discoveryCopy } from '@wms/contracts';
import type { Database } from '../../db/mysql.ts';
import { AppError } from '../../shared/errors.ts';

export async function validateNewDiscovery(db: Database, id: string, warehouse: string, product: string) {
  if (
    await db.get('SELECT product_code FROM stocktake_snapshots WHERE stocktake_id=? AND product_code=?', [id, product])
  )
    throw new AppError('DISCOVERY_IN_SNAPSHOT', discoveryCopy.inSnapshot, 422);
  if (await db.get('SELECT id FROM stocktake_discovery_lines WHERE stocktake_id=? AND product_code=?', [id, product]))
    throw new AppError('DISCOVERY_DUPLICATE', discoveryCopy.duplicate, 422);
  await validateDiscoveryProduct(db, warehouse, product);
}
export async function validateDiscoveryProduct(db: Database, warehouse: string, product: string) {
  const valid = await db.get(
    'SELECT code FROM master_products WHERE code=? AND inventory_eligible=1 AND active=1 AND source_del_flag=0 FOR SHARE',
    [product],
  );
  if (!valid) throw new AppError('DISCOVERY_PRODUCT_INVALID', discoveryCopy.invalidProduct, 422);
  const stock = await db.get(
    'SELECT packages,weight_tonnes,source_del_flag FROM stock WHERE warehouse_code=? AND product_code=? FOR UPDATE',
    [warehouse, product],
  );
  if (
    stock &&
    (Number(stock.packages) !== 0 || Number(stock.weight_tonnes) !== 0 || Number(stock.source_del_flag) !== 0)
  )
    throw new AppError('DISCOVERY_STOCK_EXISTS', discoveryCopy.existingStock, 422);
}
export async function discoveryState(db: Database, id: string, warehouse: string) {
  const overlap = await db.get(
    `SELECT COUNT(*) AS n FROM stocktake_discovery_lines d
    JOIN stocktake_snapshots s ON s.stocktake_id=d.stocktake_id AND s.product_code=d.product_code
    WHERE d.stocktake_id=?`,
    [id],
  );
  const invalid = await db.get(
    `SELECT COUNT(*) AS n FROM stocktake_discovery_lines d
    LEFT JOIN master_products p ON p.code=d.product_code
    LEFT JOIN stock b ON b.warehouse_code=d.warehouse_code AND b.product_code=d.product_code
    WHERE d.stocktake_id=? AND (d.warehouse_code<>? OR p.code IS NULL OR p.active<>1
    OR p.inventory_eligible<>1 OR p.source_del_flag<>0 OR b.source_del_flag<>0
    OR COALESCE(b.packages,0)<>0 OR COALESCE(b.weight_tonnes,0)<>0)`,
    [id, warehouse],
  );
  const versions = await db.all('SELECT id,version FROM stocktake_discovery_lines WHERE stocktake_id=? ORDER BY id', [
    id,
  ]);
  return { overlap: Number(overlap?.n ?? 0), invalid: Number(invalid?.n ?? 0), versions };
}
