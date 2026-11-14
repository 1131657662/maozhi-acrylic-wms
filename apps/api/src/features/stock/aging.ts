import type { StockAging } from '@wms/contracts';
import type { Database, Row } from '../../db/mysql.ts';
import { aggregateGrams } from '../web-lists/query.ts';
import { balanceFields, balanceFrom } from '../reports/sql.ts';
import { normalizeEvent } from '../reports/normalize.ts';
import type { LedgerEvent } from '../reports/types.ts';
import { projectStockAging } from './aging-projection.ts';

export async function agingStock(db: Database, rows: Row[], asOf: string): Promise<Map<string, StockAging>> {
  const result = new Map<string, StockAging>();
  if (!rows.length) return result;
  const values = rows.flatMap((row) => [String(row.warehouseCode), String(row.productCode)]);
  const events = await db.all(
    `SELECT /* stock-aging-batch */ ${balanceFields} ${balanceFrom}
     WHERE s.source_del_flag=0 AND (s.warehouse_code,s.product_code) IN (${rows.map(() => '(?,?)').join(',')})
     ORDER BY s.id`,
    values,
  );
  const grouped = new Map<string, LedgerEvent[]>();
  for (const row of events) {
    const event = normalizeEvent(row),
      key = JSON.stringify([event.warehouseCode, event.productCode]);
    const group = grouped.get(key) ?? [];
    group.push(event);
    grouped.set(key, group);
  }
  for (const row of rows) {
    const key = JSON.stringify([row.warehouseCode, row.productCode]);
    result.set(
      key,
      projectStockAging(
        grouped.get(key) ?? [],
        {
          packages: Number(row.packages),
          weightGrams: aggregateGrams(row.weight_tonnes),
          sourceRow: row.source_row_json,
        },
        asOf,
      ),
    );
  }
  return result;
}
