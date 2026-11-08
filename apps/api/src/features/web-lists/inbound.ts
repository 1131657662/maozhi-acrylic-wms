import { z } from 'zod';
import { webInboundListSchema, type WebInboundQuery } from '@wms/contracts';
import type { Database } from '../../db/mysql.ts';
import { isoDate } from '../../db/dates.ts';
import {
  aggregateGrams,
  dateFilter,
  pageResult,
  readPage,
  statusFilter,
  textFilter,
  type ListReadQuery,
} from './query.ts';

const fields = `r.id,r.receipt_no AS receiptNo,r.status,r.posting_state AS postingState,
  r.confirmation_operation_id AS confirmationOperationId,r.supplier_code AS supplierCode,COALESCE(s.name,r.supplier_code) AS supplierName,
  r.warehouse_code AS warehouseCode,COALESCE(w.name,r.warehouse_code) AS warehouseName,
  r.memo,r.created_by AS createdBy,r.created_at AS createdAt`;
const sortColumns = {
  createdAt: 'r.created_at',
  receiptNo: 'r.receipt_no',
  supplierName: 'supplierName',
  warehouseName: 'warehouseName',
  status: 'r.status',
  postingState: 'r.posting_state',
};
export function inboundPredicate(query: Omit<WebInboundQuery, 'pageSize'> & { pageSize: number }) {
  const parts = {
    sql: `FROM inbound_receipts r LEFT JOIN master_suppliers s ON s.code=r.supplier_code
    LEFT JOIN master_warehouses w ON w.code=r.warehouse_code WHERE r.source_del_flag=0`,
    values: [] as string[],
  };
  textFilter(parts, ['r.receipt_no'], query.keyword);
  textFilter(parts, ['r.supplier_code', 's.name'], query.supplier);
  textFilter(parts, ['r.warehouse_code', 'w.name'], query.warehouse);
  statusFilter(parts, 'r.status', query);
  dateFilter(parts, 'r.created_at', query);
  if (query.postingState) {
    parts.sql += ' AND r.posting_state=?';
    parts.values.push(query.postingState);
  }
  return parts;
}
async function lineSummaries(db: Database, ids: string[]) {
  if (!ids.length) return new Map<string, { packages: number; weightGrams: number; products: string[] }>();
  const rows = await db.all(
    `SELECT l.receipt_id,SUM(l.packages) AS packages,SUM(l.weight_tonnes) AS tonnes,
    JSON_ARRAYAGG(COALESCE(p.name,l.product_code)) AS products FROM inbound_lines l
    LEFT JOIN master_products p ON p.code=l.product_code AND p.source_del_flag=0
    WHERE l.source_del_flag=0 AND l.receipt_id IN (${ids.map(() => '?').join(',')}) GROUP BY l.receipt_id`,
    ids,
  );
  return new Map(
    rows.map((row) => [
      String(row.receipt_id),
      {
        packages: Number(row.packages),
        weightGrams: aggregateGrams(row.tonnes),
        products: z
          .array(z.string())
          .parse(typeof row.products === 'string' ? JSON.parse(row.products) : row.products)
          .sort(),
      },
    ]),
  );
}
export async function listWebInbound(db: Database, query: ListReadQuery<WebInboundQuery>) {
  return db.transaction(async (tx) => {
    const page = await readPage(
      tx,
      {
        fields,
        predicate: inboundPredicate(query),
        order: `${sortColumns[query.sortBy]} ${query.direction},r.id ${query.direction}`,
      },
      query,
    );
    const summaries = await lineSummaries(
      tx,
      page.rows.map((row) => String(row.id)),
    );
    const items = page.rows.map((row) => ({
      ...row,
      createdAt: isoDate(row.createdAt),
      ...(summaries.get(String(row.id)) ?? { packages: 0, weightGrams: 0, products: [] }),
    }));
    return webInboundListSchema.parse(pageResult(items, page.total, query));
  });
}
