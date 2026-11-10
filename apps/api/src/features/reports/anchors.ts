import type { Hash } from 'node:crypto';
import type { ReportQuery } from '@wms/contracts';
import type { Database, Row } from '../../db/mysql.ts';
import type { Cell, Period } from './types.ts';
import { dimensionFilter } from './sql.ts';
import { cellFor, mark } from './periods.ts';
import { markInterval } from './accumulate.ts';
import { objectJson, nullableInt, optionalGrams } from './source-values.ts';

interface Anchors {
  cells: Map<string, Cell>;
  periods: Period[];
  query: ReportQuery;
  digest: Hash;
}
function validateStock(cell: Cell, row: Row, periods: Period[]): void {
  const last = cell.previous;
  if (!last) {
    for (const item of cell.periods.values()) mark(item, '仅有库存开始时库存，未记录可定位的切账时间/流水；不可验证');
    return;
  }
  if (last.afterPackages !== nullableInt(row.packages) || last.afterGrams !== optionalGrams(row.weight_tonnes))
    markInterval(cell, periods, {
      start: last.localTime ?? '',
      end: '9999',
      reason: '末笔流水与独立库存开始时库存不一致',
    });
  const source = objectJson(row.source_row_json),
    legacy = cell.lastHistorical;
  if (!legacy) return;
  const packages = nullableInt(source.stock_qty),
    grams = optionalGrams(source.stock_weight);
  if (packages === null || grams === null) {
    for (const item of cell.periods.values()) mark(item, '历史流水缺少有效的原始导入库存锚点；不可验证');
  } else if (packages !== legacy.afterPackages || grams !== legacy.afterGrams) {
    for (const item of cell.periods.values()) mark(item, '历史流水末值与导入原始库存锚点不一致');
  }
}
function observeStock(row: Row, state: Anchors): string {
  state.digest.update(JSON.stringify(row));
  const key = JSON.stringify([row.warehouse_code, row.product_code]);
  const cell =
    state.cells.get(key) ??
    cellFor(
      {
        warehouseCode: String(row.warehouse_code),
        warehouseName: String(row.warehouseName),
        productCode: String(row.product_code),
        productName: String(row.productName),
      },
      state.periods,
    );
  state.cells.set(key, cell);
  cell.snapshotPackages = nullableInt(row.packages);
  cell.snapshotGrams = optionalGrams(row.weight_tonnes);
  validateStock(cell, row, state.periods);
  return key;
}
export async function validateAnchors(db: Database, state: Anchors): Promise<void> {
  const filter = dimensionFilter(state.query);
  const rows = await db.all(
    `SELECT s.warehouse_code,s.product_code,s.packages,s.weight_tonnes,s.source_row_json,
    p.name AS productName,COALESCE(w.name,s.warehouse_code) AS warehouseName
    FROM stock s JOIN master_products p ON p.code=s.product_code AND p.inventory_eligible=1
    LEFT JOIN master_warehouses w ON w.code=s.warehouse_code WHERE s.source_del_flag=0 ${filter.sql}`,
    filter.values,
  );
  const seen = new Set<string>();
  for (const row of rows) {
    seen.add(observeStock(row, state));
  }
  for (const [key, cell] of state.cells)
    if (!seen.has(key)) for (const row of cell.periods.values()) mark(row, '缺少独立期末库存开始时库存，未按零处理');
}
