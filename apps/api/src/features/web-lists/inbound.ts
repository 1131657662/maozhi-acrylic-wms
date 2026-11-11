import { z } from 'zod';
import { webInboundListSchema, SNAPSHOT_MISSING_TEXT, type WebInboundQuery } from '@wms/contracts';
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
  r.confirmation_operation_id AS confirmationOperationId,r.supplier_code AS supplierCode,COALESCE(NULLIF(r.supplier_name_snapshot,''),'${SNAPSHOT_MISSING_TEXT}') AS supplierName,
  r.warehouse_code AS warehouseCode,COALESCE(NULLIF(r.warehouse_name_snapshot,''),'${SNAPSHOT_MISSING_TEXT}') AS warehouseName,
  r.contact_id AS contactId,r.delivery_name AS deliveryName,r.delivery_phone AS deliveryPhone,r.delivery_address AS deliveryAddress,
  r.bill_type AS billType,r.container_no AS containerNo,r.memo,r.created_by AS createdBy,r.created_at AS createdAt`;
const sortColumns = {
  createdAt: 'r.created_at',
  receiptNo: 'r.receipt_no',
  supplierName: 'supplierName',
  warehouseName: 'warehouseName',
  status: 'r.status',
  postingState: 'r.posting_state',
  billType: 'r.bill_type',
  packages:
    '(SELECT COALESCE(SUM(sl.packages),0) FROM inbound_lines sl WHERE sl.receipt_id=r.id AND sl.source_del_flag=0)',
  weightGrams:
    '(SELECT COALESCE(SUM(sl.weight_tonnes),0) FROM inbound_lines sl WHERE sl.receipt_id=r.id AND sl.source_del_flag=0)',
};
export function inboundPredicate(query: Omit<WebInboundQuery, 'pageSize'> & { pageSize: number }) {
  const parts = {
    sql: `FROM inbound_receipts r LEFT JOIN master_suppliers s ON s.code=r.supplier_code
    LEFT JOIN master_warehouses w ON w.code=r.warehouse_code WHERE r.source_del_flag=0`,
    values: [] as (string | number)[],
  };
  textFilter(parts, ['r.receipt_no'], query.keyword);
  textFilter(parts, ['r.supplier_code', 'r.supplier_name_snapshot'], query.supplier);
  textFilter(parts, ['r.warehouse_code', 'r.warehouse_name_snapshot'], query.warehouse);
  statusFilter(parts, 'r.status', query);
  dateFilter(parts, 'r.created_at', query);
  if (query.postingState) {
    parts.sql += ' AND r.posting_state=?';
    parts.values.push(query.postingState);
  }
  if (query.billType) {
    parts.sql += ' AND r.bill_type=?';
    parts.values.push(query.billType);
  }
  if (query.productCodes?.length) {
    const placeholders = query.productCodes.map(() => '?').join(',');
    if (query.productMode === 'all') {
      parts.sql += ` AND (SELECT COUNT(DISTINCT ml.product_code) FROM inbound_lines ml
        WHERE ml.receipt_id=r.id AND ml.source_del_flag=0 AND ml.product_code IN (${placeholders}))=?`;
      parts.values.push(...query.productCodes, query.productCodes.length);
    } else {
      parts.sql += ` AND EXISTS (SELECT 1 FROM inbound_lines ml
        WHERE ml.receipt_id=r.id AND ml.source_del_flag=0 AND ml.product_code IN (${placeholders}))`;
      parts.values.push(...query.productCodes);
    }
  }
  return parts;
}
async function lineSummaries(db: Database, ids: string[]) {
  if (!ids.length)
    return new Map<string, { packages: number; weightGrams: number; products: string[]; productModels: string[] }>();
  const rows = await db.all(
    `SELECT l.receipt_id,SUM(l.packages) AS packages,SUM(l.weight_tonnes) AS tonnes,
    JSON_ARRAYAGG(COALESCE(NULLIF(l.product_name_snapshot,''),'${SNAPSHOT_MISSING_TEXT}')) AS products,JSON_ARRAYAGG(COALESCE(NULLIF(l.product_model_snapshot,''),'${SNAPSHOT_MISSING_TEXT}')) AS productModels FROM inbound_lines l
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
        productModels: z
          .array(z.string())
          .parse(typeof row.productModels === 'string' ? JSON.parse(row.productModels) : row.productModels)
          .sort(),
        products: z
          .array(z.string())
          .parse(typeof row.products === 'string' ? JSON.parse(row.products) : row.products)
          .sort(),
      },
    ]),
  );
}
type MatchedLine = {
  lineId: string;
  productCode: string;
  productName: string;
  packages: number;
  weightGrams: number;
};
async function matchedLineMap(db: Database, ids: string[], productCodes?: string[]) {
  const result = new Map<string, { matchedLineCount: number; matchedLines: MatchedLine[] }>();
  if (!ids.length || !productCodes?.length) return result;
  const rows = await db.all(
    `SELECT l.receipt_id AS parentId,l.id AS lineId,l.product_code AS productCode,
      COALESCE(NULLIF(l.product_name_snapshot,''),'${SNAPSHOT_MISSING_TEXT}') AS productName,
      l.packages,l.weight_tonnes AS tonnes
     FROM inbound_lines l
     WHERE l.source_del_flag=0 AND l.receipt_id IN (${ids.map(() => '?').join(',')})
       AND l.product_code IN (${productCodes.map(() => '?').join(',')})
     ORDER BY l.receipt_id,l.id`,
    [...ids, ...productCodes],
  );
  for (const row of rows) {
    const parentId = String(row.parentId);
    const lines = result.get(parentId)?.matchedLines ?? [];
    lines.push({
      lineId: String(row.lineId),
      productCode: String(row.productCode),
      productName: String(row.productName),
      packages: Number(row.packages),
      weightGrams: aggregateGrams(row.tonnes),
    });
    result.set(parentId, { matchedLineCount: lines.length, matchedLines: lines });
  }
  return result;
}
export async function listWebInbound(db: Database, query: ListReadQuery<WebInboundQuery>) {
  return db.transaction(async (tx) => {
    const predicate = inboundPredicate(query);
    const page = await readPage(
      tx,
      {
        fields,
        predicate,
        order: `${sortColumns[query.sortBy]} ${query.direction},r.id ${query.direction}`,
      },
      query,
    );
    const summaries = await lineSummaries(
      tx,
      page.rows.map((row) => String(row.id)),
    );
    const matched = query.productCodes?.length
      ? await matchedLineMap(
          tx,
          page.rows.map((row) => String(row.id)),
          query.productCodes,
        )
      : undefined;
    const matchedTotals = query.productCodes?.length
      ? await inboundMatchedTotals(tx, query.productCodes, predicate, page.total)
      : undefined;
    const items = page.rows.map((row) => ({
      ...row,
      createdAt: isoDate(row.createdAt),
      ...(summaries.get(String(row.id)) ?? { packages: 0, weightGrams: 0, products: [], productModels: [] }),
      ...(query.productCodes?.length
        ? (matched?.get(String(row.id)) ?? { matchedLineCount: 0, matchedLines: [] })
        : {}),
    }));
    return webInboundListSchema.parse({
      ...pageResult(items, page.total, query),
      ...(matchedTotals ? { matchedTotals } : {}),
    });
  });
}

async function inboundMatchedTotals(
  db: Database,
  productCodes: string[],
  predicate: ReturnType<typeof inboundPredicate>,
  documentCount: number,
) {
  const rows = await db.all(
    `SELECT COUNT(*) AS lineCount,SUM(l.packages) AS packages,SUM(l.weight_tonnes) AS tonnes
     FROM inbound_lines l WHERE l.source_del_flag=0 AND l.product_code IN (${productCodes.map(() => '?').join(',')})
       AND EXISTS (SELECT 1 ${predicate.sql} AND r.id=l.receipt_id)`,
    [...productCodes, ...predicate.values],
  );
  const row = rows[0];
  return {
    documentCount,
    lineCount: Number(row?.lineCount ?? 0),
    packages: Number(row?.packages ?? 0),
    weightGrams: aggregateGrams(row?.tonnes ?? '0.0000'),
  };
}
