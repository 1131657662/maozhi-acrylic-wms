import type { Hash } from 'node:crypto';
import type { ReportQuery } from '@wms/contracts';
import type { Database } from '../../db/mysql.ts';
import { dimensionFilter } from './sql.ts';

export async function sourceDiagnostics(db: Database, query: ReportQuery) {
  const filter = dimensionFilter(query);
  const from = `FROM stock_journal s LEFT JOIN master_products p ON p.code=s.product_code LEFT JOIN master_warehouses w ON w.code=s.warehouse_code`;
  const deleted = await db.get(
    `SELECT COUNT(*) AS n ${from} WHERE s.source_del_flag=1 AND (p.code IS NULL OR p.source_kind<>'sku-spec') ${filter.sql}`,
    filter.values,
  );
  const unknown = await db.get(
    `SELECT COUNT(*) AS n ${from} WHERE s.source_del_flag=0 AND (p.code IS NULL OR p.source_kind NOT IN ('erp-product','sku-spec')) ${filter.sql}`,
    filter.values,
  );
  return { excludedDeleted: Number(deleted?.n ?? 0), unassignedRows: Number(unknown?.n ?? 0) };
}
// A mutable document label must invalidate an export snapshot, including changes outside its current page.
export async function hashReferences(db: Database, digest: Hash): Promise<void> {
  const sources = [
    {
      table: 'inbound_receipts',
      key: 'id',
      fields: 'id,receipt_no,status,source_row_json,created_at,created_by,memo,supplier_code',
    },
    {
      table: 'outbound_orders',
      key: 'id',
      fields: 'id,order_no,status,source_row_json,created_at,vehicle_no,customer_name',
    },
    { table: 'master_suppliers', key: 'code', fields: 'code,name' },
  ];
  for (const source of sources) {
    let cursor = '';
    for (;;) {
      const rows = await db.all(
        `SELECT ${source.fields} FROM ${source.table} WHERE ${source.key}>? ORDER BY ${source.key} LIMIT 1000`,
        [cursor],
      );
      if (!rows.length) break;
      for (const row of rows) digest.update(JSON.stringify(row));
      cursor = String(rows.at(-1)![source.key]);
    }
  }
}
