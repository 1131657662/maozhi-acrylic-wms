import type { DatedEvent } from './restated-events.ts';
import type { Cell, LedgerEvent } from './types.ts';
import { addExact } from './arithmetic.ts';

export function turnoverMovements(
  cell: Cell,
  range: { fromDay: string; throughDay: string },
  restated?: DatedEvent[],
): number | null {
  const events: (LedgerEvent | DatedEvent)[] = restated
    ? restated.filter((event) => event.warehouseCode === cell.warehouseCode && event.productCode === cell.productCode)
    : (cell.events ?? []);
  let total = 0;
  for (const event of events) {
    if (event.family !== 'outbound') continue;
    const day = 'reportingDate' in event ? event.reportingDate : event.localTime?.slice(0, 10);
    if (!day && restated) return null;
    if (day && day >= range.fromDay && day <= range.throughDay) total = addExact(total, event.weightGrams);
  }
  return total;
}
