import type { ReportMeta } from '@wms/contracts';
import type { Cell, LedgerEvent, Projection } from './types.ts';

export interface CompletePeriod {
  days: string[];
  throughDay: string;
  incomplete: boolean;
}

export function shanghaiToday(now = Date.now()): string {
  return new Date(now + 8 * 3600000).toISOString().slice(0, 10);
}

export function completePeriod(fromDay: string, toDay: string, today = shanghaiToday()): CompletePeriod {
  const throughDay = toDay >= today ? shiftDay(today, -1) : toDay;
  const days: string[] = [];
  for (let day = fromDay; day <= throughDay; day = shiftDay(day, 1)) days.push(day);
  return { days, throughDay, incomplete: toDay >= today };
}
const snapshotPeriods = new WeakMap<Projection, Map<string, CompletePeriod>>();
export function snapshotPeriod(query: { fromDay: string; toDay: string }, projection: Projection): CompletePeriod {
  const periods = snapshotPeriods.get(projection) ?? new Map<string, CompletePeriod>();
  snapshotPeriods.set(projection, periods);
  const key = `${query.fromDay}/${query.toDay}`;
  let period = periods.get(key);
  if (!period) {
    period = completePeriod(query.fromDay, query.toDay, shanghaiToday(Date.parse(projection.snapshot.watermarks.asOf)));
    periods.set(key, period);
  }
  return period;
}

export function shiftDay(day: string, offset: number): string {
  return new Date(Date.parse(day + 'T00:00:00Z') + offset * 86400000).toISOString().slice(0, 10);
}

const countEvents = new WeakMap<LedgerEvent[], { length: number; events: LedgerEvent[] }>();
export function periodCounts(events: LedgerEvent[], fromDay: string, toDay: string) {
  const adjustments = new Set<string>(),
    stocktakes = new Set<string>();
  let relevant = countEvents.get(events);
  if (!relevant || relevant.length !== events.length) {
    relevant = {
      length: events.length,
      events: events.filter((event) => ['manual', 'import', 'count'].includes(event.family)),
    };
    countEvents.set(events, relevant);
  }
  for (const event of relevant.events) {
    if (!event.localTime) continue;
    const day = event.localTime.slice(0, 10);
    if (day < fromDay || day > toDay) continue;
    const key = event.operationId ?? event.id;
    if (event.family === 'manual' || event.family === 'import') adjustments.add(event.id);
    if (event.family === 'count') stocktakes.add(key);
  }
  return {
    adjustmentCount: adjustments.size,
    stocktakeCount: stocktakes.size,
    adjustmentSummary: `本期含调整 ${adjustments.size} 笔、含盘点回写 ${stocktakes.size} 次`,
  };
}

export { dailyBalances } from './derived-balances.ts';

export type DerivedMetaArgs = {
  fromDay: string;
  toDay: string;
  countFromDay: string;
  countToDay: string;
  days: number;
  completeDays: number;
  incomplete: boolean;
  formula: string;
  adjustmentCount: number;
  stocktakeCount: number;
};

export function derivedMeta(
  projection: Projection,
  args: DerivedMetaArgs,
): ReportMeta & Omit<DerivedMetaArgs, 'incomplete'> & { scopeStatus: 'complete' | 'incomplete' | 'empty' } {
  const scopeStatus = args.incomplete ? 'incomplete' : args.days === 0 ? 'empty' : 'complete';
  const { incomplete: _incomplete, ...metadata } = args;
  return { ...projection.metadata, ...metadata, scopeStatus };
}

export function stateReasons(cell: Cell): string[] {
  const range = cell.periods.get('range');
  return range?.checkState === '不可验证' ? [...range.reasons] : [];
}
