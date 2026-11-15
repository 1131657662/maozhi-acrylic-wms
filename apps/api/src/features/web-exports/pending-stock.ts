import { webStockQuantitySchema, type WebStockRow } from '@wms/contracts';
import type { Database } from '../../db/mysql.ts';
import { pendingStockSql } from '../stock/pending-query.ts';

// The extra product bound is implied by the warehouse/product pairs. It lets
// MySQL seek outbound_product_fk instead of rescanning every open order per batch.
export async function pendingExportStock(db: Database, keys: Pick<WebStockRow, 'warehouseCode' | 'productCode'>[]) {
  if (!keys.length) return new Map<string, WebStockRow['pending']>();
  const products = [...new Set(keys.map((key) => key.productCode))];
  const rows = await db.all(pendingStockSql(keys.length, products.length), [
    ...products,
    ...keys.flatMap((key) => [key.warehouseCode, key.productCode]),
  ]);
  return new Map(
    rows.map((row) => [
      JSON.stringify([row.warehouseCode, row.productCode]),
      webStockQuantitySchema.parse({ packages: Number(row.packages), weightGrams: Number(row.weightGrams) }),
    ]),
  );
}
