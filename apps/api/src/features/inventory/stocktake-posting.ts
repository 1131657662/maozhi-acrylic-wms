import type { Database, Row } from '../../db/mysql.ts';
import { ensure } from '../../shared/errors.ts';
import type { InventoryOperation } from './operation.ts';
import { activeMaster } from '../master-data/catalogs.ts';

async function validateRows(db: Database, id: string, warehouse: string): Promise<void> {
  const invalid = await db.get(
    `SELECT COUNT(*) AS n FROM stocktake_snapshots s
    JOIN stocktake_readings r USING(stocktake_id,product_code)
    LEFT JOIN master_products p ON p.code=s.product_code
    LEFT JOIN stock b ON b.warehouse_code=? AND b.product_code=s.product_code
    WHERE s.stocktake_id=? AND (r.packages IS NULL OR p.code IS NULL OR p.inventory_eligible<>1
      OR p.source_del_flag<>0 OR p.active<>1 OR b.source_del_flag<>0
      OR s.packages<>COALESCE(b.packages,0) OR s.weight_tonnes<>COALESCE(b.weight_tonnes,0))`,
    [warehouse, id],
  );
  ensure(Number(invalid?.n) === 0, 'STOCKTAKE_POSTING_INVALID', '实盘不完整、ERP 商品不可用或库存偏离快照，禁止覆盖');
}
async function writeBatch(db: Database, operation: InventoryOperation, warehouse: string, rows: Row[]): Promise<void> {
  const stockValues = rows.flatMap((r) => [
    warehouse,
    String(r.product_code),
    Number(r.actual_packages),
    String(r.actual_tonnes),
  ]);
  await db.run(
    `INSERT INTO stock(warehouse_code,product_code,packages,weight_tonnes) VALUES ${rows.map(() => '(?,?,?,?)').join(',')}
    ON DUPLICATE KEY UPDATE packages=VALUES(packages),weight_tonnes=VALUES(weight_tonnes)`,
    stockValues,
  );
  const journalValues = rows.flatMap((r) => [
    operation.id,
    warehouse,
    String(r.product_code),
    Number(r.packages_delta),
    String(r.tonnes_delta),
    Number(r.packages),
    Number(r.actual_packages),
    String(r.weight_tonnes),
    String(r.actual_tonnes),
  ]);
  await db.run(
    `INSERT INTO stock_journal(operation_id,warehouse_code,product_code,packages_delta,tonnes_delta,
    packages_before,packages_after,tonnes_before,tonnes_after,created_at)
    VALUES ${rows.map(() => '(?,?,?,?,?,?,?,?,?,UTC_TIMESTAMP(3))').join(',')}`,
    journalValues,
  );
}
// Same writer lock + single outer transaction as confirmations. Batches never commit independently.
export async function postCountedInventory(
  db: Database,
  operation: InventoryOperation,
  warehouse: string,
): Promise<number> {
  ensure(operation.type === 'stocktake.post', 'INVALID_OPERATION', '盘点入账操作类型不正确');
  await activeMaster(db, 'warehouses', warehouse);
  const window = await db.get('SELECT stocktake_id FROM stocktake_windows WHERE active_warehouse=?', [warehouse]);
  ensure(window?.stocktake_id === operation.targetId, 'STOCKTAKE_WINDOW_LOST', '盘点暂停窗口归属异常');
  await db.all(
    `SELECT p.code FROM master_products p JOIN stocktake_snapshots s ON s.product_code=p.code
    WHERE s.stocktake_id=? ORDER BY p.code FOR SHARE`,
    [operation.targetId],
  );
  await db.all(
    `SELECT b.product_code FROM stock b JOIN stocktake_snapshots s ON s.product_code=b.product_code
    WHERE s.stocktake_id=? AND b.warehouse_code=? AND b.source_del_flag=0 ORDER BY b.product_code FOR UPDATE`,
    [operation.targetId, warehouse],
  );
  await validateRows(db, operation.targetId, warehouse);
  let last = '',
    count = 0;
  for (;;) {
    const rows = await db.all(
      `SELECT s.*,r.packages AS actual_packages,r.weight_tonnes AS actual_tonnes,
      r.packages-s.packages AS packages_delta,r.weight_tonnes-s.weight_tonnes AS tonnes_delta
      FROM stocktake_snapshots s JOIN stocktake_readings r USING(stocktake_id,product_code)
      WHERE s.stocktake_id=? AND s.product_code>? AND (r.packages<>s.packages OR r.weight_tonnes<>s.weight_tonnes)
      ORDER BY s.product_code LIMIT 500`,
      [operation.targetId, last],
    );
    if (!rows.length) return count;
    await writeBatch(db, operation, warehouse, rows);
    last = String(rows.at(-1)!.product_code);
    count += rows.length;
  }
}
