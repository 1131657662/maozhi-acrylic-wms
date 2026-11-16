import type { Cell, LedgerEvent } from './types.ts';

type Boundary = { first: LedgerEvent; last: LedgerEvent };
const indexes = new WeakMap<LedgerEvent[], { length: number; days: Map<string, Boundary> }>();

// Projection event arrays are complete before derived reports read them. Index once for all monthly windows.
function boundaries(events: LedgerEvent[]): Map<string, Boundary> {
  const cached = indexes.get(events);
  if (cached?.length === events.length) return cached.days;
  const days = new Map<string, Boundary>();
  for (const event of events) {
    if (!event.localTime) continue;
    const day = event.localTime.slice(0, 10),
      current = days.get(day);
    if (current) current.last = event;
    else days.set(day, { first: event, last: event });
  }
  indexes.set(events, { length: events.length, days });
  return days;
}

function opening(byDay: Map<string, Boundary>, first: string | undefined): number | null {
  if (!first) return null;
  let prior: LedgerEvent | undefined, next: LedgerEvent | undefined;
  for (const [day, boundary] of byDay) {
    if (day < first) prior = boundary.last;
    else {
      next = boundary.first;
      break;
    }
  }
  return prior?.afterGrams ?? (next?.beforeGrams === 0 ? 0 : null);
}

export function dailyBalances(cell: Cell, days: string[]) {
  const byDay = boundaries(cell.events ?? []);
  let balance = opening(byDay, days[0]),
    completeDays = 0,
    sumGrams = 0;
  for (const day of days) {
    const boundary = byDay.get(day);
    if (boundary) balance = boundary.last.afterGrams;
    if (balance !== null && balance >= 0) {
      completeDays++;
      sumGrams += balance;
    }
  }
  return { completeDays, sumGrams: completeDays === days.length ? sumGrams : null };
}
