import type { Hash } from 'node:crypto';
import type { ReportQuery } from '@wms/contracts';
import type { Database } from '../../db/mysql.ts';
import { dimensionFilter, postedLocal, validPosted } from './sql.ts';
import { snapshotLocalTime, type ReportSnapshot } from './snapshot.ts';

export async function sourceDiagnostics(db: Database, query: ReportQuery, snapshot: ReportSnapshot) {
  const filter = dimensionFilter({ warehouse: query.warehouse, product: query.product });
  const from = `FROM stock_journal s LEFT JOIN master_products p ON p.code=s.product_code
    LEFT JOIN master_warehouses w ON w.code=s.warehouse_code LEFT JOIN inventory_operations o ON o.id=s.operation_id`;
  const cutoff = ` AND s.id<=? AND (COALESCE(${validPosted},0)=0 OR ${postedLocal}<=?)`;
  const values = [...filter.values, snapshot.watermarks.journalMaxId, snapshotLocalTime(snapshot)];
  const counts = await db.get(
    `SELECT COALESCE(SUM(s.source_del_flag=1),0) AS excludedDeleted,
      COALESCE(SUM(s.source_del_flag=0),0) AS unassignedRows ${from}
      WHERE (p.code IS NULL OR p.source_kind<>'sku-spec')
        AND (s.source_del_flag=1 OR (s.source_del_flag=0 AND (p.code IS NULL OR p.inventory_eligible=0)))
        ${filter.sql} ${cutoff}`,
    values,
  );
  return { excludedDeleted: Number(counts?.excludedDeleted ?? 0), unassignedRows: Number(counts?.unassignedRows ?? 0) };
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
