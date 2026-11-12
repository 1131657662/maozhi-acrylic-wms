import { reportDetailRowSchema, type ReportQuery, type ReportView } from '@wms/contracts';
import type { Database } from '../../db/mysql.ts';
import { hash } from '../../shared/hash.ts';
import type { Projection, ReportReadQuery } from './types.ts';
import { pageResult } from '../web-lists/query.ts';
import { readDatedEvents, dayInRange, type DatedEvent } from './restated-events.ts';
import { buildBridge } from './bridge.ts';
import { restatedBalance } from './restated-balance.ts';
import { restatedMonths } from './restated-months.ts';

export async function buildRestatement(db: Database, query: ReportQuery, projection: Projection) {
  const events = await readDatedEvents(db, query, projection),
    balance = restatedBalance(events);
  const view: ReportView = {
    basis: 'restated',
    inventoryBasis: 'posted',
    watermarks: projection.snapshot.watermarks,
    balanceMode: 'unverifiable',
    bridge: buildBridge(events, query),
    restatedBalance: balance,
  };
  return { events, view, monthly: restatedMonths(events, projection, balance), digest: hash(JSON.stringify(events)) };
}
export type Restatement = Awaited<ReturnType<typeof buildRestatement>>;
export function postedView(projection: Projection): ReportView {
  return {
    basis: 'posted',
    inventoryBasis: 'posted',
    watermarks: projection.snapshot.watermarks,
    balanceMode: 'posted',
  };
}
function detailRow(event: DatedEvent, projection: Projection) {
  const cell = projection.cells.get(JSON.stringify([event.warehouseCode, event.productCode]));
  return reportDetailRowSchema.parse(
    Object.fromEntries(
      Object.keys(reportDetailRowSchema.shape).map((key) => [
        key,
        key === 'checkState'
          ? (cell?.periods.get(event.localTime?.slice(0, 7) ?? '')?.checkState ?? '不可验证')
          : event[key as keyof DatedEvent],
      ]),
    ),
  );
}
export function restatedDetails(data: Restatement, query: ReportReadQuery, projection: Projection) {
  const events = data.events.filter(
    (event) =>
      ['inbound', 'outbound'].includes(event.family) &&
      (query.movement === 'all' || event.family === query.movement) &&
      (event.reportingDate === null || dayInRange(event.reportingDate, query)),
  );
  const sign = query.direction === 'asc' ? 1 : -1;
  const key = query.sortBy === 'postedAt' || query.sortBy === 'period' ? 'reportingDate' : query.sortBy;
  events.sort((a, b) => sign * ((a[key] ?? '9999').localeCompare(b[key] ?? '9999') || a.sequence - b.sequence));
  return pageResult(
    events
      .slice((query.page - 1) * query.pageSize, query.page * query.pageSize)
      .map((event) => detailRow(event, projection)),
    events.length,
    query,
  );
}
