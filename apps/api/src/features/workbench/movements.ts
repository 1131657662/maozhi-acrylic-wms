import { WORKBENCH, workbenchCopy as copy, type WorkbenchPeriod, type ReportMonthlyRow } from '@wms/contracts';
import type { Database, Row } from '../../db/mysql.ts';
import { normalizeEvent } from '../reports/normalize.ts';
import { addMovement } from '../reports/accumulate.ts';
import { emptyMonth } from '../reports/periods.ts';
import { metric, unknownMetric, localTime } from './metrics.ts';
import { movementGroups, movementUnknowns } from './movement-query.ts';

const empty = () => emptyMonth({ warehouseCode: '', warehouseName: '', productCode: '', productName: '' }, 'range');
function dailyTotals(rows: Row[], period: WorkbenchPeriod) {
  const today = localTime(period.to).slice(0, 10),
    days = new Map<string, ReportMonthlyRow>(),
    previous = empty();
  for (let n = WORKBENCH.trendDays - 1; n >= 0; n--)
    days.set(localTime(new Date(Date.parse(period.from) - n * WORKBENCH.dayMs).toISOString()).slice(0, 10), empty());
  const yesterday = localTime(new Date(Date.parse(period.from) - WORKBENCH.dayMs).toISOString()).slice(0, 10);
  for (const row of rows) {
    const event = normalizeEvent(row),
      day = String(row.day);
    if (days.has(day)) addMovement(days.get(day)!, event);
    if (day === yesterday && Number(row.previousWindow)) addMovement(previous, event);
  }
  return { today: days.get(today)!, days, previous };
}
function quantity(
  row: ReportMonthlyRow,
  direction: 'inbound' | 'outbound',
  context: { period: WorkbenchPeriod; reason: string | null },
) {
  const { period, reason } = context;
  return {
    packages: reason ? unknownMetric('包', period, reason) : metric(row[`${direction}Packages`], '包', period),
    grams: reason ? unknownMetric('克', period, reason) : metric(row[`${direction}Grams`], '克', period),
  };
}
function change(now: number, previous: number, context: { period: WorkbenchPeriod; reason: string | null }) {
  if (context.reason) return unknownMetric('%', context.period, copy.compareUnknown);
  if (!previous) return unknownMetric('%', context.period, copy.zeroBase);
  return metric(Number((((now - previous) / Math.abs(previous)) * 100).toFixed(2)), '%', context.period);
}
export async function dashboardMovements(db: Database, period: WorkbenchPeriod) {
  const rows = await movementGroups(db, period),
    unknown = await movementUnknowns(db);
  const reason = Number(unknown?.missingTime)
    ? copy.missingTime
    : Number(unknown?.missingSource)
      ? copy.missingSource
      : null;
  const totals = dailyTotals(rows, period),
    context = { period, reason };
  return {
    inbound: quantity(totals.today, 'inbound', context),
    outbound: quantity(totals.today, 'outbound', context),
    inboundChange: change(totals.today.inboundGrams, totals.previous.inboundGrams, context),
    outboundChange: change(totals.today.outboundGrams, totals.previous.outboundGrams, context),
    points: [...totals.days].map(([day, row]) => {
      const from = new Date(`${day}T00:00:00+08:00`).toISOString();
      const to = new Date(Math.min(Date.parse(from) + WORKBENCH.dayMs, Date.parse(period.to))).toISOString();
      return {
        day,
        inbound: quantity(row, 'inbound', { period: { from, to }, reason }),
        outbound: quantity(row, 'outbound', { period: { from, to }, reason }),
      };
    }),
  };
}
