import {
  reportSelections,
  reportMovementLabels,
  reportTypeLabels,
  type ReportQuery,
  type ReportFacets,
} from '@wms/contracts';
import type { DatedEvent } from './restated-events.ts';
import type { ReportMonthlyRow } from '@wms/contracts';

type Dimension = 'warehouses' | 'movements' | 'types';
export function eventType(event: DatedEvent): string {
  if (event.operationType === 'stock.correct') return 'correction';
  return event.reverse ? 'reversal' : event.family;
}
export function selectedMovement(query: ReportQuery): string[] {
  return query.movements !== undefined
    ? reportSelections(query.movements)
    : query.movement === 'all'
      ? []
      : [query.movement];
}
export function matchesEvent(event: DatedEvent, query: ReportQuery, ignore?: Dimension): boolean {
  const warehouses = reportSelections(query.warehouseCodes),
    movements = selectedMovement(query),
    types = reportSelections(query.types);
  return (
    (ignore === 'warehouses' || !warehouses.length || warehouses.includes(event.warehouseCode)) &&
    (ignore === 'movements' || !movements.length || movements.includes(event.family)) &&
    (ignore === 'types' || !types.length || types.includes(eventType(event)))
  );
}
export function visibleEvents(events: DatedEvent[], query: ReportQuery): DatedEvent[] {
  return events.filter(
    (e) =>
      ['inbound', 'outbound'].includes(e.family) &&
      (e.reportingDate === null
        ? query.basis === 'restated'
        : e.reportingDate >= query.fromDay && e.reportingDate <= query.toDay),
  );
}
export function movementFiltered(query: ReportQuery): boolean {
  return !!(selectedMovement(query).length || reportSelections(query.types).length);
}
const monthKey = (e: DatedEvent) => JSON.stringify([e.reportingDate?.slice(0, 7), e.warehouseCode, e.productCode]);
export function baseFacets(
  events: DatedEvent[],
  monthly: ReportMonthlyRow[],
  query: ReportQuery,
  detail: boolean,
): ReportFacets {
  const ranged = visibleEvents(events, query),
    warehouses = new Map<string, string>();
  for (const row of detail ? ranged : monthly) warehouses.set(row.warehouseCode, row.warehouseName);
  const count = (dimension: Dimension, value: string) => {
    if (!detail && dimension === 'warehouses' && !movementFiltered(query))
      return monthly.filter((r) => r.warehouseCode === value).length;
    const rows = ranged.filter(
      (e) =>
        matchesEvent(e, query, dimension) &&
        (dimension === 'warehouses' ? e.warehouseCode : dimension === 'movements' ? e.family : eventType(e)) === value,
    );
    return detail ? rows.length : new Set(rows.filter((e) => e.reportingDate).map(monthKey)).size;
  };
  return {
    warehouses: [...warehouses].map(([value, label]) => ({ value, label, count: count('warehouses', value) })),
    movements: Object.entries(reportMovementLabels).map(([value, label]) => ({
      value,
      label,
      count: count('movements', value),
    })),
    types: Object.entries(reportTypeLabels).map(([value, label]) => ({ value, label, count: count('types', value) })),
  };
}
export function warehouseFacets(rows: { warehouseCode: string; warehouseName: string }[]): ReportFacets {
  const counts = new Map<string, { value: string; label: string; count: number }>();
  for (const row of rows) {
    const item = counts.get(row.warehouseCode) ?? { value: row.warehouseCode, label: row.warehouseName, count: 0 };
    item.count++;
    counts.set(row.warehouseCode, item);
  }
  return { warehouses: [...counts.values()], movements: [], types: [] };
}
