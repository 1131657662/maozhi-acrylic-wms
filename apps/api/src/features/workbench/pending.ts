import { WORKBENCH, workbenchCopy as copy, statusText, type WorkbenchPeriod, type WorkbenchTodo } from '@wms/contracts';
import type { Database, Row } from '../../db/mysql.ts';
import { isoDate } from '../../db/dates.ts';
import { businessText } from '../audit/projection.ts';
import { metric } from './metrics.ts';
import { pendingRows } from './pending-query.ts';

export function outboundLabel(row: Row): string {
  if (row.status === 'open') return row.scan_closed_at ? copy.scanned : copy.planning;
  return statusText(String(row.status), 'outbound');
}
function todo(row: Row, asOf: string): WorkbenchTodo {
  const stocktake = row.kind === 'stocktake',
    stale = row.kind === 'stale';
  const start = stocktake ? row.started : stale ? row.scan_closed_at : null;
  const elapsedHours = start ? Math.max(0, (Date.parse(asOf) - Date.parse(isoDate(start))) / 3_600_000) : null;
  return {
    href: `/${stocktake ? 'stocktakes' : row.kind === 'inbound' ? 'inbound' : 'outbound'}/${encodeURIComponent(String(row.id))}`,
    number: businessText(row.number, copy.numberMissing),
    at: row.at ? isoDate(row.at) : null,
    warehouse: businessText(row.warehouse, copy.warehouseMissing),
    elapsedHours,
    overdue: stale || (stocktake && elapsedHours !== null && elapsedHours >= WORKBENCH.lockHours),
    label: stocktake
      ? start
        ? copy.stocktake
        : copy.missingLock
      : row.kind === 'inbound'
        ? copy.inboundPending
        : outboundLabel(row),
  };
}
export async function dashboardPending(db: Database, period: WorkbenchPeriod) {
  const rows = await pendingRows(db, period.to),
    current = { from: period.to, to: period.to };
  const group = (kind: string) => {
    const items = rows.filter((row) => row.kind === kind);
    return {
      count: metric(Number(items[0]?.total ?? 0), '单', current),
      items: items.map((row) => todo(row, period.to)),
    };
  };
  const inbound = group('inbound'),
    outbound = group('outbound');
  return {
    total: metric(inbound.count.value! + outbound.count.value!, '单', current),
    inbound,
    outbound,
    stocktake: group('stocktake'),
    stale: group('stale'),
    historyReason: copy.history,
    missingScanTime: metric(Number(rows.find((row) => row.kind === 'outbound')?.missing_time ?? 0), '单', current),
  };
}
