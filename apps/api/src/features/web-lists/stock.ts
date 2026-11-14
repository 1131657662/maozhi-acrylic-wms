import { webStockListSchema, type WebStockQuery, type WebStockRow } from '@wms/contracts';
import type { Database, Row } from '../../db/mysql.ts';
import { hash } from '../../shared/hash.ts';
import { isoDate } from '../../db/dates.ts';
import { reportUnclassifiedStock } from '../stock/source-diagnostics.ts';
import { pendingStock } from '../stock/pending.ts';
import { aggregateGrams, pageResult, readPage, textFilter, type ListReadQuery, type Predicate } from './query.ts';

const fields = `s.warehouse_code AS warehouseCode,COALESCE(w.name,s.warehouse_code) AS warehouseName,
  s.product_code AS productCode,p.name AS productName,p.source_kind AS sourceKind,s.packages,s.weight_tonnes`;
const sortColumns = {
  warehouseCode: 's.warehouse_code',
  productCode: 's.product_code',
  productName: 'p.name',
  packages: 's.packages',
  weightGrams: 's.weight_tonnes',
};
export function stockPredicate(query: Omit<WebStockQuery, 'pageSize'> & { pageSize: number }) {
  const parts = {
    sql: `FROM stock s JOIN master_products p ON p.code=s.product_code
    LEFT JOIN master_warehouses w ON w.code=s.warehouse_code
    WHERE s.source_del_flag=0 AND p.inventory_eligible=1${query.source ? " AND p.source_kind='erp-product'" : ''}`,
    values: [] as string[],
  };
  textFilter(parts, ['s.product_code', 'p.name'], query.product);
  textFilter(parts, ['s.warehouse_code', 'w.name'], query.warehouse);
  return parts;
}
export async function listWebStock(db: Database, query: ListReadQuery<WebStockQuery>) {
  if (!query.exportSnapshot) await reportUnclassifiedStock(db);
  return db.transaction(async (tx) => {
    const predicate = stockPredicate(query);
    const page = await readPage(
      tx,
      {
        fields,
        predicate,
        order: `${sortColumns[query.sortBy]} ${query.direction},s.warehouse_code ${query.direction},s.product_code ${query.direction}`,
      },
      query,
    );
    const subtotal = query.exportSnapshot?.subtotal ?? (await stockSubtotal(tx, predicate));
    const items = await stockItems(tx, page.rows, query);
    const result = {
      ...pageResult(items, page.total, query),
      source: query.scope ?? query.source,
      subtotal,
    };
    const watermark = hash(JSON.stringify(result));
    const clock = await tx.get('SELECT UTC_TIMESTAMP(3) AS asOf');
    return webStockListSchema.parse({ ...result, viewToken: watermark, watermark, asOf: isoDate(clock?.asOf) });
  });
}
async function stockItems(db: Database, rows: Row[], query: ListReadQuery<WebStockQuery>) {
  const keys = rows.map((row) => ({ warehouseCode: String(row.warehouseCode), productCode: String(row.productCode) }));
  const balances = await pendingStock(db, keys);
  return rows.map(({ weight_tonnes, ...row }) => {
    const id = JSON.stringify([row.warehouseCode, row.productCode]);
    const onHand = { packages: Number(row.packages), weightGrams: aggregateGrams(weight_tonnes) };
    const pending: WebStockRow['pending'] = balances.get(id) ?? { packages: 0, weightGrams: 0 };
    return {
      ...row,
      id,
      source: query.scope ?? query.source,
      ...onHand,
      onHand,
      pending,
      available: {
        packages: onHand.packages - pending.packages,
        weightGrams: onHand.weightGrams - pending.weightGrams,
      },
    };
  });
}
async function stockSubtotal(db: Database, predicate: Predicate) {
  const sum = await db.get(
    `SELECT COALESCE(SUM(s.packages),0) AS packages,
    COALESCE(SUM(s.weight_tonnes),0.0000) AS tonnes ${predicate.sql}`,
    predicate.values,
  );
  return { packages: Number(sum?.packages ?? 0), weightGrams: aggregateGrams(sum?.tonnes ?? '0.0000') };
}
