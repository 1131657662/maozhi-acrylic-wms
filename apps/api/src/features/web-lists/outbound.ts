import { z } from 'zod';
import { webOutboundListSchema, SNAPSHOT_MISSING_TEXT, type WebOutboundQuery } from '@wms/contracts';
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

const fields = `o.id,o.order_no AS orderNo,o.customer_name AS customerName,o.warehouse_code AS warehouseCode,
  COALESCE(NULLIF(o.warehouse_name_snapshot,''),'${SNAPSHOT_MISSING_TEXT}') AS warehouseName,o.ship_to_name AS shipToName,o.ship_to_phone AS shipToPhone,o.ship_to_address AS shipToAddress,o.vehicle_no AS vehicleNo,o.status,o.created_at AS createdAt`;
const sortColumns = {
  createdAt: 'o.created_at',
  orderNo: 'o.order_no',
  customerName: 'o.customer_name',
  warehouseName: 'warehouseName',
  vehicleNo: 'o.vehicle_no',
  status: 'o.status',
};
export function outboundPredicate(query: Omit<WebOutboundQuery, 'pageSize'> & { pageSize: number }) {
  const parts = {
    sql: `FROM outbound_orders o LEFT JOIN master_warehouses w ON w.code=o.warehouse_code
    WHERE o.source_del_flag=0`,
    values: [] as (string | number)[],
  };
  textFilter(parts, ['o.order_no'], query.keyword);
  textFilter(parts, ['o.customer_code', 'o.customer_name'], query.customer);
  textFilter(parts, ['o.warehouse_code', 'o.warehouse_name_snapshot'], query.warehouse);
  textFilter(parts, ['o.vehicle_no'], query.vehicle);
  statusFilter(parts, 'o.status', query);
  dateFilter(parts, 'o.created_at', query);
  if (query.productCodes?.length) {
    const placeholders = query.productCodes.map(() => '?').join(',');
    if (query.productMode === 'all') {
      parts.sql += ` AND (SELECT COUNT(DISTINCT ml.product_code) FROM outbound_lines ml
        WHERE ml.order_id=o.id AND ml.source_del_flag=0 AND ml.product_code IN (${placeholders}))=?`;
      parts.values.push(...query.productCodes, query.productCodes.length);
    } else {
      parts.sql += ` AND EXISTS (SELECT 1 FROM outbound_lines ml
        WHERE ml.order_id=o.id AND ml.source_del_flag=0 AND ml.product_code IN (${placeholders}))`;
      parts.values.push(...query.productCodes);
    }
  }
  return parts;
}
async function summaries(db: Database, ids: string[]) {
  if (!ids.length) return { planned: new Map(), actual: new Map() };
  const placeholders = ids.map(() => '?').join(',');
  const planned = await db.all(
    `SELECT order_id AS id,SUM(planned_packages) AS packages,SUM(planned_weight_tonnes) AS tonnes,
    JSON_ARRAYAGG(COALESCE(NULLIF(product_name,''),'${SNAPSHOT_MISSING_TEXT}')) AS products,
    JSON_ARRAYAGG(COALESCE(NULLIF(product_model_snapshot,''),'${SNAPSHOT_MISSING_TEXT}')) AS productModels
    FROM outbound_lines WHERE source_del_flag=0 AND order_id IN (${placeholders}) GROUP BY order_id`,
    ids,
  );
  const actual = await db.all(
    `SELECT plan_id AS id,COUNT(*) AS packages,SUM(weight_tonnes) AS tonnes
    FROM scan_facts WHERE plan_id IN (${placeholders}) GROUP BY plan_id`,
    ids,
  );
  const values = (rows: typeof planned) =>
    new Map(
      rows.map((row) => [String(row.id), { packages: Number(row.packages), weightGrams: aggregateGrams(row.tonnes) }]),
    );
  const plannedValues = new Map(
    planned.map((row) => [
      String(row.id),
      {
        ...values([row]).get(String(row.id))!,
        products: z
          .array(z.string())
          .parse(typeof row.products === 'string' ? JSON.parse(row.products) : row.products)
          .sort(),
        productModels: z
          .array(z.string())
          .parse(typeof row.productModels === 'string' ? JSON.parse(row.productModels) : row.productModels)
          .sort(),
      },
    ]),
  );
  return { planned: plannedValues, actual: values(actual) };
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
    `SELECT l.order_id AS parentId,l.id AS lineId,l.product_code AS productCode,
      COALESCE(NULLIF(l.product_name,''),'${SNAPSHOT_MISSING_TEXT}') AS productName,
      l.planned_packages AS packages,l.planned_weight_tonnes AS tonnes
     FROM outbound_lines l
     WHERE l.source_del_flag=0 AND l.order_id IN (${ids.map(() => '?').join(',')})
       AND l.product_code IN (${productCodes.map(() => '?').join(',')})
     ORDER BY l.order_id,l.id`,
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
export async function listWebOutbound(db: Database, query: ListReadQuery<WebOutboundQuery>) {
  return db.transaction(async (tx) => {
    const predicate = outboundPredicate(query);
    const page = await readPage(
      tx,
      {
        fields,
        predicate,
        order: `${sortColumns[query.sortBy]} ${query.direction},o.id ${query.direction}`,
      },
      query,
    );
    const sums = await summaries(
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
      ? await outboundMatchedTotals(tx, query.productCodes, predicate, page.total)
      : undefined;
    const items = page.rows.map((row) => ({
      ...row,
      createdAt: isoDate(row.createdAt),
      products: sums.planned.get(String(row.id))?.products ?? [],
      productModels: sums.planned.get(String(row.id))?.productModels ?? [],
      plannedPackages: sums.planned.get(String(row.id))?.packages ?? 0,
      plannedWeightGrams: sums.planned.get(String(row.id))?.weightGrams ?? 0,
      actualPackages: sums.actual.get(String(row.id))?.packages ?? 0,
      actualWeightGrams: sums.actual.get(String(row.id))?.weightGrams ?? 0,
      ...(query.productCodes?.length
        ? (matched?.get(String(row.id)) ?? { matchedLineCount: 0, matchedLines: [] })
        : {}),
    }));
    return webOutboundListSchema.parse({
      ...pageResult(items, page.total, query),
      ...(matchedTotals ? { matchedTotals } : {}),
    });
  });
}

async function outboundMatchedTotals(
  db: Database,
  productCodes: string[],
  predicate: ReturnType<typeof outboundPredicate>,
  documentCount: number,
) {
  const rows = await db.all(
    `SELECT COUNT(*) AS lineCount,SUM(l.planned_packages) AS packages,SUM(l.planned_weight_tonnes) AS tonnes
     FROM outbound_lines l WHERE l.source_del_flag=0 AND l.product_code IN (${productCodes.map(() => '?').join(',')})
       AND EXISTS (SELECT 1 ${predicate.sql} AND o.id=l.order_id)`,
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
