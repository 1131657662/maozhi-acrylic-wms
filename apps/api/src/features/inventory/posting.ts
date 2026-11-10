import type { StockBalance } from '@wms/contracts';
import type { Database } from '../../db/mysql.ts';
import { decimalToGrams, gramsToDecimal } from '../../db/weight.ts';
import { ensure } from '../../shared/errors.ts';
import { activeMaster } from '../master-data/catalogs.ts';
import type { InventoryOperation } from './operation.ts';
import { assertWarehouseOpen } from '../stocktake/window.ts';

export interface StockChange {
  productCode: string;
  packagesDelta: number;
  weightDeltaGrams: number;
  expected?: StockBalance;
}
export interface PostedChange extends StockChange {
  before: StockBalance;
  after: StockBalance;
}

export async function requireInventoryProduct(db: Database, code: string): Promise<void> {
  const product = await db.get(
    'SELECT inventory_eligible,active,source_del_flag FROM master_products WHERE code=? FOR SHARE',
    [code],
  );
  ensure(Number(product?.inventory_eligible) === 1, 'PRODUCT_NOT_INVENTORY', '商品没有库存资格；条码目录不参与入账');
  ensure(
    Number(product?.active) === 1 && Number(product?.source_del_flag) === 0,
    'MASTER_DATA_INACTIVE',
    '商品不存在或已停用',
  );
}
async function balances(db: Database, warehouse: string, change: StockChange) {
  await requireInventoryProduct(db, change.productCode);
  const row = await db.get(
    `SELECT packages,weight_tonnes FROM stock
    WHERE warehouse_code=? AND product_code=? AND source_del_flag=0 FOR UPDATE`,
    [warehouse, change.productCode],
  );
  const before = { packages: Number(row?.packages ?? 0), weightGrams: row ? decimalToGrams(row.weight_tonnes) : 0 };
  ensure(
    !change.expected ||
      (before.packages === change.expected.packages && before.weightGrams === change.expected.weightGrams),
    'STALE_STOCK',
    '库存已变化，输入已保留；请刷新当前值并核对后重试',
  );
  const after = {
    packages: before.packages + change.packagesDelta,
    weightGrams: before.weightGrams + change.weightDeltaGrams,
  };
  ensure(after.packages >= 0 && after.weightGrams >= 0, 'INSUFFICIENT_STOCK', '库存包数或实重不足，操作未执行');
  ensure(
    after.packages <= 2_147_483_647 && after.weightGrams <= 99_999_999_999_900,
    'STOCK_OVERFLOW',
    '库存超过数据库精度上限，操作未执行',
  );
  return { before, after };
}
async function writeChange(db: Database, operation: InventoryOperation, warehouse: string, change: PostedChange) {
  await db.run(
    `INSERT INTO stock(warehouse_code,product_code,packages,weight_tonnes,source_del_flag) VALUES(?,?,?,?,0)
    ON DUPLICATE KEY UPDATE packages=VALUES(packages),weight_tonnes=VALUES(weight_tonnes)`,
    [warehouse, change.productCode, change.after.packages, gramsToDecimal(change.after.weightGrams)],
  );
  await db.run(
    `INSERT INTO stock_journal(operation_id,order_id,inbound_receipt_id,warehouse_code,product_code,
    packages_delta,tonnes_delta,packages_before,packages_after,tonnes_before,tonnes_after,correction_id,created_at)
    VALUES(?,?,?,?,?,?,?,?,?,?,?,?,UTC_TIMESTAMP(3))`,
    [
      operation.id,
      operation.type.startsWith('outbound.') ? operation.targetId : null,
      operation.type.startsWith('inbound.') ? operation.targetId : null,
      warehouse,
      change.productCode,
      change.packagesDelta,
      gramsToDecimal(change.weightDeltaGrams),
      change.before.packages,
      change.after.packages,
      gramsToDecimal(change.before.weightGrams),
      gramsToDecimal(change.after.weightGrams),
      operation.type === 'stock.correct' ? operation.targetId : null,
    ],
  );
}
// Caller owns the transaction and has acquired lockInventoryWriter before any document locks.
export async function prepareInventory(
  db: Database,
  warehouse: string,
  changes: StockChange[],
): Promise<PostedChange[]> {
  await assertWarehouseOpen(db, warehouse);
  await activeMaster(db, 'warehouses', warehouse);
  const posted: PostedChange[] = [];
  for (const change of [...changes].sort((a, b) => a.productCode.localeCompare(b.productCode))) {
    const result = { ...change, ...(await balances(db, warehouse, change)) };
    posted.push(result);
  }
  return posted;
}
export async function postPreparedInventory(
  db: Database,
  input: {
    operation: InventoryOperation;
    warehouse: string;
    changes: PostedChange[];
  },
): Promise<void> {
  for (const change of input.changes) await writeChange(db, input.operation, input.warehouse, change);
}
export async function postInventory(
  db: Database,
  operation: InventoryOperation,
  warehouse: string,
  changes: StockChange[],
) {
  const posted = await prepareInventory(db, warehouse, changes);
  await postPreparedInventory(db, { operation, warehouse, changes: posted });
  return posted;
}
