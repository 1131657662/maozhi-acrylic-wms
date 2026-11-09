import type { ReportQuery, ReportMonthlyRow } from '@wms/contracts';
import type { Period, Cell, LedgerEvent } from './types.ts';

export function nextDay(day: string): string {
  return new Date(Date.parse(day) + 86400000).toISOString().slice(0, 10);
}
export function reportPeriods(query: ReportQuery): Period[] {
  const start = query.fromDay + ' 00:00:00',
    end = nextDay(query.toDay) + ' 00:00:00';
  const periods: Period[] = [{ key: 'range', start, end }];
  let month = query.fromDay.slice(0, 7) + '-01';
  while (month <= query.toDay) {
    const next = new Date(Date.parse(month));
    next.setUTCMonth(next.getUTCMonth() + 1);
    const finish = next.toISOString().slice(0, 10);
    periods.push({
      key: month.slice(0, 7),
      start: month + ' 00:00:00' < start ? start : month + ' 00:00:00',
      end: finish + ' 00:00:00' > end ? end : finish + ' 00:00:00',
    });
    month = finish;
  }
  return periods;
}
export function emptyMonth(
  cell: Pick<Cell, 'warehouseCode' | 'warehouseName' | 'productCode' | 'productName'>,
  period: string,
): ReportMonthlyRow {
  return {
    ...cell,
    id: JSON.stringify([period, cell.warehouseCode, cell.productCode]),
    period,
    openingPackages: null,
    openingGrams: null,
    closingPackages: null,
    closingGrams: null,
    differencePackages: null,
    differenceGrams: null,
    inboundPackages: 0,
    inboundGrams: 0,
    outboundPackages: 0,
    outboundGrams: 0,
    adjustmentPackages: 0,
    adjustmentGrams: 0,
    inboundConfirmedPackages: 0,
    inboundConfirmedGrams: 0,
    inboundReversedPackages: 0,
    inboundReversedGrams: 0,
    outboundConfirmedPackages: 0,
    outboundConfirmedGrams: 0,
    outboundReversedPackages: 0,
    outboundReversedGrams: 0,
    manualPackages: 0,
    manualGrams: 0,
    countPackages: 0,
    countGrams: 0,
    importPackages: 0,
    importGrams: 0,
    unknownPackages: 0,
    unknownGrams: 0,
    netPackages: 0,
    netGrams: 0,
    inboundDocuments: 0,
    outboundDocuments: 0,
    inboundReversals: 0,
    outboundReversals: 0,
    checkState: '可验证',
    reasons: [],
    timeStatus: 'UTC → 上海时间',
  };
}
export function cellFor(
  event: Pick<LedgerEvent, 'warehouseCode' | 'warehouseName' | 'productCode' | 'productName'>,
  periods: Period[],
): Cell {
  const identity = {
    warehouseCode: event.warehouseCode,
    warehouseName: event.warehouseName,
    productCode: event.productCode,
    productName: event.productName,
  };
  return {
    ...identity,
    periods: new Map(periods.map((p) => [p.key, emptyMonth(identity, p.key)])),
    firstTime: null,
    missingTime: false,
    boundaries: new Map(),
    events: [],
  };
}
export function mark(row: ReportMonthlyRow, reason: string): void {
  row.checkState = '不可验证';
  if (!row.reasons.includes(reason) && row.reasons.length < 12) row.reasons.push(reason);
}
