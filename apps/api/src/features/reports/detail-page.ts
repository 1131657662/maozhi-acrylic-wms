import { reportDetailRowSchema } from '@wms/contracts';
import type { Database, Row } from '../../db/mysql.ts';
import { pageResult } from '../web-lists/query.ts';
import type { Projection, ReportReadQuery } from './types.ts';
import {
  dimensionFilter,
  ledgerFields,
  ledgerFrom,
  balanceFrom,
  movementPredicate,
  postedLocal,
  validPosted,
} from './sql.ts';
import { normalizeEvent } from './normalize.ts';
import { snapshotLocalTime } from './snapshot.ts';

interface PageContext {
  projection: Projection;
  query: ReportReadQuery;
  cursor?: number;
}
export function naturalOrder(projection: Projection, query: ReportReadQuery): boolean {
  return projection.chronological && ['postedAt', 'period'].includes(query.sortBy);
}
function directionPredicate(movement: ReportReadQuery['movement']): string {
  if (movement === 'all') return '';
  return movement === 'inbound'
    ? " AND (COALESCE(o.operation_type,s.source_business_type) IN ('inbound','inbound.confirm','inbound.reverse') OR sc.inbound_receipt_id IS NOT NULL)"
    : " AND (COALESCE(o.operation_type,s.source_business_type) IN ('outbound','outbound.confirm','outbound.reverse') OR sc.outbound_order_id IS NOT NULL)";
}
async function pageIds(db: Database, { projection, query, cursor }: PageContext) {
  const filter = dimensionFilter(query),
    range = projection.periods[0]!,
    direction = query.direction === 'asc' ? 'ASC' : 'DESC';
  const natural = naturalOrder(projection, query),
    useCursor = natural && cursor !== undefined;
  const sorts = {
    postedAt: postedLocal,
    period: postedLocal,
    productCode: 's.product_code',
    warehouseCode: 's.warehouse_code',
  };
  const order = natural ? `s.id ${direction}` : `${sorts[query.sortBy]} ${direction},s.id ${direction}`;
  const values: (string | number)[] = [
    range.start,
    range.end,
    snapshotLocalTime(projection.snapshot),
    projection.snapshot.watermarks.journalMaxId,
    ...filter.values,
  ];
  if (useCursor) values.push(cursor);
  const after = useCursor ? ` AND s.id${query.direction === 'asc' ? '>' : '<'}?` : '';
  const movement = directionPredicate(query.movement);
  return db.all(
    `SELECT /*+ NO_BNL(p,w,o) */ STRAIGHT_JOIN s.id ${balanceFrom}
    WHERE s.source_del_flag=0 AND ${movementPredicate} AND ${postedLocal}>=? AND ${postedLocal}<?
    AND ${postedLocal}<=? AND s.id<=? AND ${validPosted} ${filter.sql} ${after} ${movement} ORDER BY ${order} LIMIT ? OFFSET ?`,
    [...values, query.pageSize, useCursor ? 0 : (query.page - 1) * query.pageSize],
  );
}
function detailRow(raw: Row, projection: Projection) {
  const event = normalizeEvent(raw),
    cell = projection.cells.get(JSON.stringify([event.warehouseCode, event.productCode]));
  event.checkState = cell?.periods.get(event.localTime?.slice(0, 7) ?? '')?.checkState ?? '不可验证';
  return reportDetailRowSchema.parse(
    Object.fromEntries(Object.keys(reportDetailRowSchema.shape).map((key) => [key, event[key as keyof typeof event]])),
  );
}
export async function detailPage(db: Database, context: PageContext) {
  const ids = await pageIds(db, context);
  const data = ids.length
    ? await db.all(
        `SELECT ${ledgerFields} ${ledgerFrom} WHERE s.id IN (${ids.map(() => '?').join(',')})`,
        ids.map((r) => Number(r.id)),
      )
    : [];
  const order = new Map(ids.map((r, i) => [Number(r.id), i]));
  data.sort((a, b) => order.get(Number(a.id))! - order.get(Number(b.id))!);
  return pageResult(
    data.map((raw) => detailRow(raw, context.projection)),
    context.projection.detailTotal,
    context.query,
  );
}
