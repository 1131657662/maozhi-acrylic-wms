import type { LedgerEvent } from './types.ts';

export interface MonthlyDocuments {
  inbound: Set<string>;
  outbound: Set<string>;
  missingInbound: boolean;
  missingOutbound: boolean;
  activity: number;
}
export function recordMonthlyDocument(counts: Map<string, MonthlyDocuments>, event: LedgerEvent, day: string): void {
  if (event.family !== 'inbound' && event.family !== 'outbound') return;
  const month = day.slice(0, 7);
  const count = counts.get(month) ?? {
    inbound: new Set<string>(),
    outbound: new Set<string>(),
    missingInbound: false,
    missingOutbound: false,
    activity: 0,
  };
  count.activity++;
  if (!event.reverse) {
    const id = event.documentId || event.orderNo;
    if (id) count[event.family].add(id);
    else if (event.family === 'inbound') count.missingInbound = true;
    else count.missingOutbound = true;
  }
  counts.set(month, count);
}
