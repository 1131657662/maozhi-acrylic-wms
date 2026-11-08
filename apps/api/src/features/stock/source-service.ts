import { sourceJournalSchema, sourceStockSchema, type StockSource } from '@wms/contracts';
import type { Database } from '../../db/mysql.ts';
import { decimalToGrams } from '../../db/weight.ts';
import { journalItem } from './journal-row.ts';
import { sourceJournalRows, sourceStockRows, sourceStockSubtotal } from './source-repository.ts';
import { reportUnclassifiedStock } from './source-diagnostics.ts';

export async function readSourceStock(db: Database, source: StockSource) {
  if (source === 'erp-product') await reportUnclassifiedStock(db);
  return db.transaction(async (tx) => {
    const rows = await sourceStockRows(tx, source);
    const subtotal = await sourceStockSubtotal(tx, source);
    return sourceStockSchema.parse({
      source,
      items: rows.map((row) => ({
        source: row.source,
        sourceKind: row.source_kind,
        productName: row.product_name,
        warehouseCode: row.warehouse_code,
        productCode: row.product_code,
        packages: Number(row.packages),
        weightGrams: decimalToGrams(row.weight_tonnes),
      })),
      subtotal: subtotal
        ? { packages: Number(subtotal.packages), weightGrams: decimalToGrams(subtotal.weight_tonnes) }
        : null,
    });
  });
}
export async function readSourceJournal(db: Database, source: StockSource, limit: number) {
  const rows = await sourceJournalRows(db, source, limit);
  return sourceJournalSchema.parse({
    source,
    items: rows.map((row) => ({ ...journalItem(row), source: row.source })),
  });
}
