import type { MasterCatalog } from '@wms/contracts';
import type { Database } from '../../db/mysql.ts';
import { AppError } from '../../shared/errors.ts';

export interface MasterReference {
  kind: string;
  documentNo: string;
}
export async function masterReferences(db: Database, catalog: MasterCatalog, code: string): Promise<MasterReference[]> {
  const references: MasterReference[] = [];
  const product = catalog === 'products';
  if (product || catalog === 'warehouses' || catalog === 'suppliers') {
    const clause = product ? 'l.product_code=?' : `r.${catalog === 'warehouses' ? 'warehouse' : 'supplier'}_code=?`;
    const rows = await db.all(
      `SELECT DISTINCT r.receipt_no AS documentNo FROM inbound_receipts r
      JOIN inbound_lines l ON l.receipt_id=r.id AND l.source_del_flag=0
      WHERE r.source_del_flag=0 AND r.posting_state='pending' AND ${clause}`,
      [code],
    );
    references.push(...rows.map((row) => ({ kind: 'inbound', documentNo: String(row.documentNo) })));
  }
  if (product || catalog === 'warehouses' || catalog === 'customers') {
    const clause = product ? 'l.product_code=?' : `o.${catalog === 'warehouses' ? 'warehouse' : 'customer'}_code=?`;
    const rows = await db.all(
      `SELECT DISTINCT o.order_no AS documentNo FROM outbound_orders o
      JOIN outbound_lines l ON l.order_id=o.id AND l.source_del_flag=0
      WHERE o.source_del_flag=0 AND o.status IN ('open','frozen','partially_shipped') AND ${clause}`,
      [code],
    );
    references.push(...rows.map((row) => ({ kind: 'outbound', documentNo: String(row.documentNo) })));
  }
  if (product || catalog === 'warehouses') references.push(...(await inventoryReferences(db, { product, code })));
  return references;
}
async function inventoryReferences(
  db: Database,
  input: { product: boolean; code: string },
): Promise<MasterReference[]> {
  const counts = await db.all(
    `SELECT DISTINCT t.number AS documentNo FROM stocktakes t
    JOIN stocktake_snapshots s ON s.stocktake_id=t.id
    WHERE t.status='counting' AND ${input.product ? 's.product_code' : 't.warehouse_code'}=?`,
    [input.code],
  );
  // Adjustments post atomically; this also fails closed for persisted unfinished operations.
  const adjustments = await db.all(
    `SELECT o.target_id AS documentNo FROM inventory_operations o
    WHERE o.operation_type='stock.adjust' AND SUBSTRING_INDEX(o.target_id,'/',${input.product ? '-1' : '1'})=?
    AND NOT EXISTS(SELECT 1 FROM stock_journal j WHERE j.operation_id=o.id)`,
    [input.code],
  );
  return [
    ...counts.map((row) => ({ kind: 'stocktake', documentNo: String(row.documentNo) })),
    ...adjustments.map((row) => ({ kind: 'adjustment', documentNo: String(row.documentNo) })),
  ];
}
export async function assertMasterUnused(db: Database, catalog: MasterCatalog, code: string): Promise<void> {
  const references = await masterReferences(db, catalog, code);
  if (references.length)
    throw new AppError('MASTER_IN_USE', '资料被进行中单据引用，不能停用', 422, {
      references,
      total: references.length,
      truncated: false,
    });
  if (
    catalog === 'warehouses' &&
    (await db.get(
      'SELECT 1 FROM stock WHERE warehouse_code=? AND source_del_flag=0 AND (packages<>0 OR weight_tonnes<>0) LIMIT 1',
      [code],
    ))
  )
    throw new AppError('WAREHOUSE_HAS_STOCK', '仓库仍有库存，不能停用', 422);
}
