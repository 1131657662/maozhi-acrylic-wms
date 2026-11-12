import { reportBalanceSchema, type ReportMonthlyRow, type RestatedBalance } from '@wms/contracts';
import type { Projection } from './types.ts';
import type { DatedEvent } from './restated-events.ts';
import { emptyMonth } from './periods.ts';
import { addMovement } from './accumulate.ts';
import { addExact } from './arithmetic.ts';

type CountField = 'inboundDocuments' | 'outboundDocuments' | 'inboundReversals' | 'outboundReversals';
function countDocument(row: ReportMonthlyRow, event: DatedEvent, counts: Map<string, Set<string>>): void {
  if (event.family !== 'inbound' && event.family !== 'outbound') return;
  const field: CountField = `${event.family}${event.reverse ? 'Reversals' : 'Documents'}`;
  const key = JSON.stringify([row.id, field]),
    ids = counts.get(key) ?? new Set<string>();
  const id = event.reverse ? event.operationId : event.documentId || event.orderNo;
  if (!id) {
    row[field] = null;
    return;
  }
  ids.add(id);
  counts.set(key, ids);
  if (row[field] !== null) row[field] = ids.size;
}
function restatedMonth(posted: ReportMonthlyRow, balance: RestatedBalance): ReportMonthlyRow {
  const identity = {
    warehouseCode: posted.warehouseCode,
    warehouseName: posted.warehouseName,
    productCode: posted.productCode,
    productName: posted.productName,
  };
  const postedBalance = reportBalanceSchema.parse(
    Object.fromEntries(
      Object.keys(reportBalanceSchema.shape).map((key) => [key, posted[key as keyof ReportMonthlyRow]]),
    ),
  );
  return {
    ...emptyMonth(identity, posted.period),
    openingPackages: posted.openingPackages,
    openingGrams: posted.openingGrams,
    closingPackages: posted.closingPackages,
    closingGrams: posted.closingGrams,
    differencePackages: posted.differencePackages,
    differenceGrams: posted.differenceGrams,
    checkState: posted.checkState,
    reasons: [...posted.reasons],
    timeStatus: posted.timeStatus,
    postedBalance,
    restatedBalance: balance,
  };
}
export function restatedMonths(
  events: DatedEvent[],
  projection: Projection,
  balance: RestatedBalance,
): ReportMonthlyRow[] {
  const rows = new Map(projection.monthly.map((row) => [row.id, restatedMonth(row, balance)]));
  const counts = new Map<string, Set<string>>(),
    range = projection.periods[0]!;
  for (const event of events) {
    const day = event.reportingDate;
    if (!day || day + ' 00:00:00' < range.start || day + ' 00:00:00' >= range.end) continue;
    const row = rows.get(JSON.stringify([day.slice(0, 7), event.warehouseCode, event.productCode]));
    if (!row) continue;
    addMovement(row, event);
    countDocument(row, event, counts);
  }
  for (const row of rows.values()) {
    row.netPackages = addExact(row.inboundPackages, -row.outboundPackages);
    row.netGrams = addExact(row.inboundGrams, -row.outboundGrams);
  }
  return [...rows.values()];
}
