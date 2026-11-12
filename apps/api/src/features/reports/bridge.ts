import type { ReportBridgeRow, ReportQuery } from '@wms/contracts';
import type { DatedEvent } from './restated-events.ts';
import { dayInRange } from './restated-events.ts';
import { addExact } from './arithmetic.ts';
import { reportCopy } from './copy.ts';

function category(event: DatedEvent): ReportBridgeRow['category'] {
  if (event.operationType === 'stock.correct' || event.family === 'correction') return '更正';
  const categories = {
    inbound: '入库',
    outbound: '出库',
    count: '盘点',
    import: '期初',
    manual: '其他',
    unknown: '其他',
  } as const;
  return categories[event.family];
}
function blankRow(month: string | null, kind: ReportBridgeRow['category'], query: ReportQuery): ReportBridgeRow {
  return {
    month,
    category: kind,
    inRange: month !== null && month >= query.fromDay.slice(0, 7) && month <= query.toDay.slice(0, 7),
    postedPackages: 0,
    postedGrams: 0,
    restatedPackages: 0,
    restatedGrams: 0,
    deltaPackages: 0,
    deltaGrams: 0,
  };
}
function addSide(
  rows: Map<string, ReportBridgeRow>,
  event: DatedEvent,
  context: { side: 'posted' | 'restated'; query: ReportQuery },
): void {
  const { side, query } = context;
  const month = (side === 'posted' ? event.localTime : event.reportingDate)?.slice(0, 7) ?? null;
  const kind = category(event),
    key = JSON.stringify([month, kind]);
  const row = rows.get(key) ?? blankRow(month, kind, query);
  row[`${side}Packages`] = addExact(row[`${side}Packages`], event.deltaPackages);
  row[`${side}Grams`] = addExact(row[`${side}Grams`], event.deltaGrams);
  const reason =
    side === 'posted' && month === null ? reportCopy.missingTime : side === 'restated' ? event.dateReason : '';
  if (reason) row.reason = [...new Set([...(row.reason?.split('；') ?? []), reason])].join('；');
  rows.set(key, row);
}
export function buildBridge(events: DatedEvent[], query: ReportQuery): ReportBridgeRow[] {
  const rows = new Map<string, ReportBridgeRow>();
  for (const event of events) {
    if (query.movement !== 'all' && event.family !== query.movement) continue;
    const postedDay = event.localTime?.slice(0, 10) ?? null;
    if (postedDay && event.reportingDate && !dayInRange(postedDay, query) && !dayInRange(event.reportingDate, query))
      continue;
    addSide(rows, event, { side: 'posted', query });
    addSide(rows, event, { side: 'restated', query });
  }
  return [...rows.values()]
    .map((row) => ({
      ...row,
      deltaPackages: addExact(row.restatedPackages, -row.postedPackages),
      deltaGrams: addExact(row.restatedGrams, -row.postedGrams),
    }))
    .sort(
      (a, b) => (a.month ?? '9999').localeCompare(b.month ?? '9999') || a.category.localeCompare(b.category, 'zh-CN'),
    );
}
