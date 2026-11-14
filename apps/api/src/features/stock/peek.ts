import { stockPeekInputSchema, stockPeekSchema, stockPairKey, STOCK_PEEK_LIMIT, type StockPair } from '@wms/contracts';
import type { Database } from '../../db/mysql.ts';
import { movementFields, movementFrom, movementItem } from './movement-row.ts';

export async function readStockPeek(db: Database, input: StockPair[]) {
  const pairs = stockPeekInputSchema.parse(input);
  const rows = await db.all(
    `WITH ranked AS (
    SELECT ${movementFields},ROW_NUMBER() OVER (
      PARTITION BY j.warehouse_code,j.product_code ORDER BY j.id DESC) AS position
    ${movementFrom} WHERE j.source_del_flag=0
      AND (j.warehouse_code,j.product_code) IN (${pairs.map(() => '(?,?)').join(',')})
  ) SELECT j.*,o.operation_type,o.reason FROM ranked j
    LEFT JOIN inventory_operations o ON o.id=j.operation_id
    WHERE j.position<=? ORDER BY j.id DESC`,
    [...pairs.flatMap((pair) => [pair.warehouseCode, pair.productCode]), STOCK_PEEK_LIMIT],
  );
  const grouped = new Map(
    pairs.map((pair) => [stockPairKey(pair), { ...pair, items: [] as ReturnType<typeof movementItem>[] }]),
  );
  for (const row of rows) {
    const key = stockPairKey({ warehouseCode: String(row.warehouse_code), productCode: String(row.product_code) });
    grouped.get(key)?.items.push(movementItem(row));
  }
  return stockPeekSchema.parse([...grouped.values()]);
}
