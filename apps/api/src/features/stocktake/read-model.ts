import { stocktakeSchema, stocktakeLineSchema, type StocktakeQuery } from '@wms/contracts';
import type { Database, Row } from '../../db/mysql.ts';
import { isoDate } from '../../db/dates.ts';
import { decimalToGrams } from '../../db/weight.ts';
import { AppError } from '../../shared/errors.ts';

const totals = `SELECT s.stocktake_id,COUNT(*) AS total_lines,COUNT(r.packages) AS recorded,
 SUM(s.packages) AS sp,SUM(s.weight_tonnes) AS sw,COALESCE(SUM(r.packages),0) AS ap,
 COALESCE(SUM(r.weight_tonnes),0) AS aw,
 COALESCE(SUM(r.packages-s.packages),0) AS dp,COALESCE(SUM(r.weight_tonnes-s.weight_tonnes),0) AS dw,
 SUM(IF(r.packages<>s.packages OR r.weight_tonnes<>s.weight_tonnes,1,0)) AS changed
 FROM stocktake_snapshots s JOIN stocktake_readings r USING(stocktake_id,product_code)`;
const headerSelect = `SELECT t.*,w.name AS warehouse_name,tot.* FROM stocktakes t
 JOIN master_warehouses w ON w.code=t.warehouse_code`;
function header(row: Row) {
  return stocktakeSchema.parse({
    id: row.id,
    number: row.number,
    warehouseCode: row.warehouse_code,
    warehouseName: row.warehouse_name,
    scope: row.scope_kind,
    mode: row.mode ?? 'open',
    revealedAt: row.revealed_at ? isoDate(row.revealed_at) : null,
    status: row.status,
    snapshotAt: isoDate(row.snapshot_at),
    snapshotHash: row.snapshot_hash,
    revision: Number(row.revision),
    lineCount: Number(row.line_count),
    recordedCount: Number(row.recorded ?? 0),
    changedCount: Number(row.changed ?? 0),
    createdBy: row.created_by,
    closedAt: row.closed_at ? isoDate(row.closed_at) : null,
    closeReason: row.close_reason,
    operationId: row.operation_id,
    snapshotPackages: Number(row.sp ?? 0),
    snapshotWeightGrams: decimalToGrams(row.sw ?? '0.0000'),
    actualPackages: Number(row.ap ?? 0),
    actualWeightGrams: decimalToGrams(row.aw ?? '0.0000'),
    packagesDelta: Number(row.dp ?? 0),
    weightDeltaGrams: decimalToGrams(row.dw ?? '0.0000'),
  });
}
export async function getStocktake(db: Database, id: string) {
  const row = await db.get(
    `${headerSelect} LEFT JOIN (${totals} WHERE s.stocktake_id=? GROUP BY s.stocktake_id)
    tot ON tot.stocktake_id=t.id WHERE t.id=?`,
    [id, id],
  );
  if (!row) throw new AppError('STOCKTAKE_NOT_FOUND', '盘点单不存在', 404);
  return header(row);
}
export async function listStocktakes(db: Database, query: StocktakeQuery) {
  const where = ['1=1'],
    values: (string | number)[] = [];
  if (query.status) {
    where.push('t.status=?');
    values.push(query.status);
  }
  if (query.warehouseCode) {
    where.push('t.warehouse_code=?');
    values.push(query.warehouseCode);
  }
  if (query.keyword) {
    where.push('t.number LIKE ?');
    values.push(`%${query.keyword}%`);
  }
  const filter = where.join(' AND ');
  const count = await db.get(`SELECT COUNT(*) AS n FROM stocktakes t WHERE ${filter}`, values);
  const rows = await db.all(
    `${headerSelect} LEFT JOIN (${totals} GROUP BY s.stocktake_id) tot ON tot.stocktake_id=t.id
    WHERE ${filter} ORDER BY t.snapshot_at DESC,t.id DESC LIMIT ? OFFSET ?`,
    [...values, query.pageSize, (query.page - 1) * query.pageSize],
  );
  return { items: rows.map(header), total: Number(count?.n ?? 0) };
}
export function reading(row: Row) {
  const snapshot = { packages: Number(row.packages), weightGrams: decimalToGrams(row.weight_tonnes) };
  const actual =
    row.actual_packages === null
      ? null
      : { packages: Number(row.actual_packages), weightGrams: decimalToGrams(row.actual_tonnes) };
  return stocktakeLineSchema.parse({
    productCode: row.product_code,
    productName: row.product_name,
    snapshot,
    actual,
    revision: Number(row.revision),
    packagesDelta: actual ? actual.packages - snapshot.packages : null,
    weightDeltaGrams: actual ? actual.weightGrams - snapshot.weightGrams : null,
  });
}
export const lineSelect = `SELECT s.*,r.packages AS actual_packages,r.weight_tonnes AS actual_tonnes,r.revision
 FROM stocktake_snapshots s JOIN stocktake_readings r USING(stocktake_id,product_code)`;
export async function stocktakeLines(db: Database, id: string, query: StocktakeQuery) {
  await getStocktake(db, id);
  const filter = 's.stocktake_id=? AND (s.product_code LIKE ? OR s.product_name LIKE ?)';
  const values = [id, `%${query.keyword}%`, `%${query.keyword}%`];
  const count = await db.get(`SELECT COUNT(*) AS n FROM stocktake_snapshots s WHERE ${filter}`, values);
  const rows = await db.all(`${lineSelect} WHERE ${filter} ORDER BY s.product_code LIMIT ? OFFSET ?`, [
    ...values,
    query.pageSize,
    (query.page - 1) * query.pageSize,
  ]);
  return { items: rows.map(reading), total: Number(count?.n ?? 0) };
}
