import { webStockQuantitySchema, type WebStockRow } from '@wms/contracts';
import type { Database } from '../../db/mysql.ts';
import { pendingStockSql } from './pending-query.ts';

type StockKey = Pick<WebStockRow, 'warehouseCode' | 'productCode'>;

export async function pendingStock(db: Database, keys: StockKey[]): Promise<Map<string, WebStockRow['pending']>> {
  if (!keys.length) return new Map();
  const rows = await db.all(
    pendingStockSql(keys.length),
    keys.flatMap((key) => [key.warehouseCode, key.productCode]),
  );
  return new Map(
    rows.map((row) => [
      JSON.stringify([row.warehouseCode, row.productCode]),
      webStockQuantitySchema.parse({ packages: Number(row.packages), weightGrams: Number(row.weightGrams) }),
    ]),
  );
}
