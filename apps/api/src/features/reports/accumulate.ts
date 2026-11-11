import type { ReportMonthlyRow } from '@wms/contracts';
import type { Cell, LedgerEvent, Period } from './types.ts';
import { mark } from './periods.ts';
import { addExact } from './arithmetic.ts';
import { reportCopy } from './copy.ts';

export function addMovement(row: ReportMonthlyRow, event: LedgerEvent): void {
  // A corrected original reverses its effective quantity. Attribute the correction
  // offset separately while preserving the journal's actual before/after balance.
  row.correctionPackages = addExact(row.correctionPackages, event.correctionOffsetPackages);
  row.correctionGrams = addExact(row.correctionGrams, event.correctionOffsetGrams);
  row.adjustmentPackages = addExact(row.adjustmentPackages, event.correctionOffsetPackages);
  row.adjustmentGrams = addExact(row.adjustmentGrams, event.correctionOffsetGrams);
  const q = event.packages,
    g = event.weightGrams;
  if (event.family === 'inbound') {
    row.inboundPackages = addExact(row.inboundPackages, q);
    row.inboundGrams = addExact(row.inboundGrams, g);
    if (event.reverse) {
      row.inboundReversedPackages = addExact(row.inboundReversedPackages, q);
      row.inboundReversedGrams = addExact(row.inboundReversedGrams, g);
    } else {
      row.inboundConfirmedPackages = addExact(row.inboundConfirmedPackages, q);
      row.inboundConfirmedGrams = addExact(row.inboundConfirmedGrams, g);
    }
  } else if (event.family === 'outbound') {
    row.outboundPackages = addExact(row.outboundPackages, q);
    row.outboundGrams = addExact(row.outboundGrams, g);
    if (event.reverse) {
      row.outboundReversedPackages = addExact(row.outboundReversedPackages, q);
      row.outboundReversedGrams = addExact(row.outboundReversedGrams, g);
    } else {
      row.outboundConfirmedPackages = addExact(row.outboundConfirmedPackages, q);
      row.outboundConfirmedGrams = addExact(row.outboundConfirmedGrams, g);
    }
  } else {
    row.adjustmentPackages = addExact(row.adjustmentPackages, event.deltaPackages);
    row.adjustmentGrams = addExact(row.adjustmentGrams, event.deltaGrams);
    row[`${event.family}Packages`] = addExact(row[`${event.family}Packages`], event.deltaPackages);
    row[`${event.family}Grams`] = addExact(row[`${event.family}Grams`], event.deltaGrams);
    if (event.family === 'unknown') mark(row, reportCopy.unknown);
  }
}
export function invalidEvent(event: LedgerEvent): string | null {
  if (
    event.beforePackages === null ||
    event.beforeGrams === null ||
    event.afterPackages === null ||
    event.afterGrams === null
  )
    return reportCopy.missingBalance;
  if (
    event.beforePackages + event.deltaPackages !== event.afterPackages ||
    event.beforeGrams + event.deltaGrams !== event.afterGrams
  )
    return reportCopy.inconsistentChange;
  if (Math.min(event.beforePackages, event.afterPackages, event.beforeGrams, event.afterGrams) < 0)
    return reportCopy.negativeBalance;
  if (
    ['inbound', 'outbound'].includes(event.family) &&
    (event.reverse ? event.packages > 0 || event.weightGrams > 0 : event.packages < 0 || event.weightGrams < 0)
  )
    return reportCopy.inconsistentDirection;
  return null;
}
function observeBoundary(cell: Cell, row: ReportMonthlyRow, period: Period, event: LedgerEvent): void {
  const time = event.localTime!,
    bounds = cell.boundaries.get(period.key) ?? {};
  if (time < period.start && (!bounds.opening || time >= bounds.opening)) {
    row.openingPackages = event.afterPackages;
    row.openingGrams = event.afterGrams;
    bounds.opening = time;
  }
  if (time === period.start + '.000000' && row.openingPackages === null) {
    row.openingPackages = event.beforePackages;
    row.openingGrams = event.beforeGrams;
  }
  if (time < period.end && (!bounds.closing || time >= bounds.closing)) {
    row.closingPackages = event.afterPackages;
    row.closingGrams = event.afterGrams;
    bounds.closing = time;
  }
  cell.boundaries.set(period.key, bounds);
}
export function markInterval(
  cell: Cell,
  periods: Period[],
  interval: { start: string; end: string; reason: string },
): void {
  for (const period of periods)
    if (interval.start < period.end && interval.end >= period.start)
      mark(cell.periods.get(period.key)!, interval.reason);
}
function checkChain(cell: Cell, event: LedgerEvent, periods: Period[]): void {
  const prior = cell.previous;
  if (!prior?.localTime || !event.localTime) return;
  if (
    prior.afterPackages === event.beforePackages &&
    prior.afterGrams === event.beforeGrams &&
    prior.localTime <= event.localTime
  )
    return;
  markInterval(cell, periods, {
    start: prior.localTime < event.localTime ? prior.localTime : event.localTime,
    end: prior.localTime > event.localTime ? prior.localTime : event.localTime,
    reason: reportCopy.brokenChain,
  });
}
export function consumeEvent(cell: Cell, event: LedgerEvent, periods: Period[]): void {
  if (!event.localTime) {
    cell.missingTime = true;
    for (const row of cell.periods.values()) mark(row, reportCopy.missingTime);
    return;
  }
  cell.firstTime ??= event.localTime;
  checkChain(cell, event, periods);
  const issue = invalidEvent(event);
  for (const period of periods) {
    const row = cell.periods.get(period.key)!;
    if (event.historical) row.timeStatus = '时间未核实';
    observeBoundary(cell, row, period, event);
    if (event.localTime >= period.start && event.localTime < period.end) {
      addMovement(row, event);
      if (issue) mark(row, issue);
    }
  }
  cell.previous = event;
  if (event.historical) cell.lastHistorical = event;
}
export function finishRow(row: ReportMonthlyRow): ReportMonthlyRow {
  row.netPackages = addExact(row.inboundPackages, -row.outboundPackages);
  row.netGrams = addExact(row.inboundGrams, -row.outboundGrams);
  if (
    row.openingPackages === null ||
    row.openingGrams === null ||
    row.closingPackages === null ||
    row.closingGrams === null
  )
    mark(row, '期初或期末证据不足；缺值不是 0');
  else {
    row.differencePackages = addExact(
      row.closingPackages,
      -row.openingPackages,
      -row.netPackages,
      -row.adjustmentPackages,
    );
    row.differenceGrams = addExact(row.closingGrams, -row.openingGrams, -row.netGrams, -row.adjustmentGrams);
    if (row.differencePackages !== 0 || row.differenceGrams !== 0) mark(row, '对账存在差额；保留原值，未填入调整列');
  }
  return row;
}
