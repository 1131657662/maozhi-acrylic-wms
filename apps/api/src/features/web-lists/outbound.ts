import { webOutboundListSchema, type WebOutboundQuery } from '@wms/contracts';
import type { Database } from '../../db/mysql.ts';
import { isoDate } from '../../db/dates.ts';
import { aggregateGrams, dateFilter, pageResult, readPage, statusFilter, textFilter } from './query.ts';

const fields = `o.id,o.order_no AS orderNo,o.customer_name AS customerName,o.warehouse_code AS warehouseCode,
  COALESCE(w.name,o.warehouse_code) AS warehouseName,o.vehicle_no AS vehicleNo,o.status,o.created_at AS createdAt`;
const sortColumns = {
  createdAt: 'o.created_at',
  orderNo: 'o.order_no',
  customerName: 'o.customer_name',
  warehouseName: 'warehouseName',
  vehicleNo: 'o.vehicle_no',
  status: 'o.status',
};
export function outboundPredicate(query: WebOutboundQuery) {
  const parts = {
    sql: `FROM outbound_orders o LEFT JOIN master_warehouses w ON w.code=o.warehouse_code
    WHERE o.source_del_flag=0`,
    values: [] as string[],
  };
  textFilter(parts, ['o.order_no'], query.keyword);
  textFilter(parts, ['o.customer_code', 'o.customer_name'], query.customer);
  textFilter(parts, ['o.warehouse_code', 'w.name'], query.warehouse);
  textFilter(parts, ['o.vehicle_no'], query.vehicle);
  statusFilter(parts, 'o.status', query);
  dateFilter(parts, 'o.created_at', query);
  return parts;
}
async function summaries(db: Database, ids: string[]) {
  if (!ids.length) return { planned: new Map(), actual: new Map() };
  const placeholders = ids.map(() => '?').join(',');
  const planned = await db.all(
    `SELECT order_id AS id,SUM(planned_packages) AS packages,SUM(planned_weight_tonnes) AS tonnes
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
  return { planned: values(planned), actual: values(actual) };
}
export async function listWebOutbound(db: Database, query: WebOutboundQuery) {
  return db.transaction(async (tx) => {
    const page = await readPage(
      tx,
      {
        fields,
        predicate: outboundPredicate(query),
        order: `${sortColumns[query.sortBy]} ${query.direction},o.id ${query.direction}`,
      },
      query,
    );
    const sums = await summaries(
      tx,
      page.rows.map((row) => String(row.id)),
    );
    const items = page.rows.map((row) => ({
      ...row,
      createdAt: isoDate(row.createdAt),
      plannedPackages: sums.planned.get(String(row.id))?.packages ?? 0,
      plannedWeightGrams: sums.planned.get(String(row.id))?.weightGrams ?? 0,
      actualPackages: sums.actual.get(String(row.id))?.packages ?? 0,
      actualWeightGrams: sums.actual.get(String(row.id))?.weightGrams ?? 0,
    }));
    return webOutboundListSchema.parse(pageResult(items, page.total, query));
  });
}
