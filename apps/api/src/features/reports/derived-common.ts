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

export function shiftDay(day: string, offset: number): string {
  return new Date(Date.parse(day + 'T00:00:00Z') + offset * 86400000).toISOString().slice(0, 10);
}

export function periodCounts(events: LedgerEvent[], fromDay: string, toDay: string) {
  const adjustments = new Set<string>(),
    stocktakes = new Set<string>();
  for (const event of events) {
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

export function dailyBalances(cell: Cell, days: string[]) {
  const byDay = eventsByDay(cell.events ?? []),
    events = cell.events ?? [],
    first = days[0],
    prior = first ? events.filter((event) => event.localTime && event.localTime < first + ' 00:00:00').at(-1) : undefined,
    firstEvent = first ? events.find((event) => event.localTime && event.localTime >= first + ' 00:00:00') : undefined;
  let balance: number | null = prior?.afterGrams ?? (firstEvent?.beforeGrams === 0 ? 0 : null);
  const values = days.map((day) => {
    const current = byDay.get(day);
    if (current?.length) balance = current.at(-1)!.afterGrams;
    return balance !== null && balance >= 0 ? balance : null;
  });
  const completeDays = values.filter((value) => value !== null).length;
  return { completeDays, sumGrams: completeDays === days.length ? values.reduce<number>((sum, value) => sum + value!, 0) : null };
}

function eventsByDay(events: LedgerEvent[]) {
  const days = new Map<string, LedgerEvent[]>();
  for (const event of events) {
    if (!event.localTime) continue;
    const key = event.localTime.slice(0, 10),
      items = days.get(key) ?? [];
    items.push(event);
    days.set(key, items);
  }
  return days;
}

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
