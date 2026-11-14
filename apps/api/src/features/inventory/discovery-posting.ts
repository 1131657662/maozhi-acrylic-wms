import { discoveryCopy, STOCKTAKE_EXPORT_PAGE_SIZE } from '@wms/contracts';
import type { Database, Row } from '../../db/mysql.ts';
import { gramsToDecimal } from '../../db/weight.ts';
import { ensure } from '../../shared/errors.ts';
import type { InventoryOperation } from './operation.ts';

async function lockDiscoveries(db: Database, id: string, warehouse: string) {
  const lines = await db.all(
    'SELECT id,product_code,warehouse_code FROM stocktake_discovery_lines WHERE stocktake_id=? ORDER BY id FOR UPDATE',
    [id],
  );
  const products = await db.all(
    `SELECT p.code,p.active,p.inventory_eligible,p.source_del_flag FROM master_products p JOIN stocktake_discovery_lines d ON d.product_code=p.code
    WHERE d.stocktake_id=? ORDER BY p.code FOR SHARE`,
    [id],
  );
  const balances = await db.all(
    `SELECT b.product_code,b.packages,b.weight_tonnes,b.source_del_flag FROM stock b JOIN stocktake_discovery_lines d ON d.product_code=b.product_code
    WHERE d.stocktake_id=? AND b.warehouse_code=? ORDER BY b.product_code FOR UPDATE`,
    [id, warehouse],
  );
  const overlap = await db.all(
    `SELECT s.product_code FROM stocktake_snapshots s
    JOIN stocktake_discovery_lines d ON d.stocktake_id=s.stocktake_id AND d.product_code=s.product_code
    WHERE d.stocktake_id=? FOR SHARE`,
    [id],
  );
  ensure(!overlap.length, 'DISCOVERY_OVERLAP', discoveryCopy.overlap);
  // Validate the locking reads, not a repeatable-read snapshot established by preview earlier in this transaction.
  const invalid =
    products.length !== lines.length ||
    lines.some((row) => row.warehouse_code !== warehouse) ||
    products.some(
      (row) => Number(row.active) !== 1 || Number(row.inventory_eligible) !== 1 || Number(row.source_del_flag) !== 0,
    ) ||
    balances.some(
      (row) => Number(row.packages) !== 0 || Number(row.weight_tonnes) !== 0 || Number(row.source_del_flag) !== 0,
    );
  ensure(!invalid, 'DISCOVERY_POSTING_INVALID', discoveryCopy.invalidPosting);
}
async function writeBatch(db: Database, operation: InventoryOperation, warehouse: string, rows: Row[]) {
  const values = rows.flatMap((row) => [
    warehouse,
    String(row.product_code),
    Number(row.packages),
    gramsToDecimal(Number(row.weight_grams)),
  ]);
  await db.run(
    `INSERT INTO stock(warehouse_code,product_code,packages,weight_tonnes)
    VALUES ${rows.map(() => '(?,?,?,?)').join(',')}
    ON DUPLICATE KEY UPDATE packages=VALUES(packages),weight_tonnes=VALUES(weight_tonnes)`,
    values,
  );
  const journal = rows.flatMap((row) => [
    operation.id,
    warehouse,
    String(row.product_code),
    Number(row.packages),
    gramsToDecimal(Number(row.weight_grams)),
    Number(row.packages),
    gramsToDecimal(Number(row.weight_grams)),
  ]);
  await db.run(
    `INSERT INTO stock_journal(operation_id,warehouse_code,product_code,packages_delta,tonnes_delta,
    packages_before,packages_after,tonnes_before,tonnes_after,created_at)
    VALUES ${rows.map(() => '(?,?,?,?,?,0,?,0,?,UTC_TIMESTAMP(3))').join(',')}`,
    journal,
  );
}
export async function postDiscoveredInventory(db: Database, operation: InventoryOperation, warehouse: string) {
  await lockDiscoveries(db, operation.targetId, warehouse);
  let last = '',
    count = 0;
  for (;;) {
    const rows = await db.all(
      `SELECT product_code,packages,weight_grams FROM stocktake_discovery_lines
      WHERE stocktake_id=? AND product_code>? AND (packages<>0 OR weight_grams<>0)
      ORDER BY product_code LIMIT ?`,
      [operation.targetId, last, STOCKTAKE_EXPORT_PAGE_SIZE],
    );
    if (!rows.length) return count;
    await writeBatch(db, operation, warehouse, rows);
    last = String(rows.at(-1)!.product_code);
    count += rows.length;
  }
}
