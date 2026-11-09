import type { ReportAgingQuery, ReportAgingRow, ReportTurnoverQuery, ReportTurnoverRow } from '@wms/contracts';
import { ageBuckets, applyFifo, emptyFifo, markFifoUnknown } from './fifo.ts';
import { completePeriod, periodCounts, shiftDay, stateReasons, dailyBalances } from './derived-common.ts';
import type { Cell, Projection } from './types.ts';

const turnoverFormula = 'R = O / M；T = D × M / O；M = ΣQ(d) / D；O 为完整日内出库确认减出库撤销（吨）';
const agingBasis =
  '按 stock_journal 入账 ID 顺序重放；可信业务日优先、否则上海入账日；吨数 FIFO；已耗用入库撤销后剩余余额无法归龄';

function commonFields(kind: string, query: { fromDay: string; toDay: string }, cell: Cell, projection: Projection) {
  const period = completePeriod(query.fromDay, query.toDay),
    countToDay = period.throughDay,
    state = cell.periods.get('range')!;
  return {
    id: JSON.stringify([kind, cell.warehouseCode, cell.productCode]),
    warehouseCode: cell.warehouseCode,
    warehouseName: cell.warehouseName,
    productCode: cell.productCode,
    productName: cell.productName,
    source: 'erp-product' as const,
    timeStatus: projection.metadata.timeStatus,
    watermark: projection.metadata.watermark,
    checkState: state.checkState,
    reasons: stateReasons(cell),
    ...periodCounts(cell.events ?? [], query.fromDay, countToDay),
    fromDay: query.fromDay,
    toDay: query.toDay,
  };
}

export function turnoverRow(query: ReportTurnoverQuery, cell: Cell, projection: Projection): ReportTurnoverRow {
  const period = completePeriod(query.fromDay, query.toDay),
    common = commonFields('report-turnover', query, cell, projection),
    balances = projection.chronological ? dailyBalances(cell, period.days) : { completeDays: 0, sumGrams: null },
    netOutboundGrams = (cell.events ?? [])
      .filter((event) =>
        event.localTime &&
        event.localTime >= query.fromDay + ' 00:00:00' &&
        event.localTime < shiftDay(period.throughDay, 1) + ' 00:00:00' &&
        event.family === 'outbound',
      )
      .reduce((sum, event) => sum + event.weightGrams, 0),
    reasons = [...common.reasons];
  if (!projection.chronological) reasons.push('入账顺序与本地时间不单调，逐日余额不可验证');
  if (balances.completeDays !== period.days.length)
    reasons.push(`逐日日终余额仅 ${balances.completeDays}/${period.days.length} 日可验证`);
  if (common.checkState === '不可验证') balances.sumGrams = null;
  if (netOutboundGrams < 0) reasons.push('本期出库撤销冲回大于出库确认，不适合计算周转');
  const averageGrams = balances.sumGrams === null || !period.days.length ? null : balances.sumGrams / period.days.length,
    turns = averageGrams !== null && averageGrams > 0 && netOutboundGrams >= 0 ? netOutboundGrams / averageGrams : null,
    turnoverDays = averageGrams !== null && averageGrams > 0 && netOutboundGrams > 0
      ? (period.days.length * averageGrams) / netOutboundGrams
      : null;
  return {
    ...common,
    days: period.days.length,
    completeDays: balances.completeDays,
    netOutboundGrams: projection.chronological ? netOutboundGrams : null,
    dailyClosingGramsSum: balances.sumGrams,
    averageInventory: averageGrams === null ? null : (averageGrams / 1_000_000).toFixed(4),
    turns: turns === null ? (netOutboundGrams === 0 && averageGrams !== null && averageGrams > 0 ? '0.0000' : null) : turns.toFixed(4),
    turnoverDays: turnoverDays === null ? null : turnoverDays.toFixed(1),
    formula: `${turnoverFormula}；D=${period.days}；M=${averageGrams === null ? '不可验证' : (averageGrams / 1_000_000).toFixed(4) + ' 吨'}`,
    checkState: reasons.length ? '不可验证' : common.checkState,
    reasons: reasons.slice(0, 12),
  };
}

function closingAt(cell: Cell, cutoffDay: string) {
  const end = shiftDay(cutoffDay, 1) + ' 00:00:00',
    next = (cell.events ?? []).find((event) => event.localTime !== null && event.localTime >= end);
  return next
    ? { packages: next.beforePackages, grams: next.beforeGrams }
    : { packages: cell.snapshotPackages ?? null, grams: cell.snapshotGrams ?? null };
}

export function agingRow(query: ReportAgingQuery, cell: Cell, projection: Projection): ReportAgingRow {
  const common = commonFields('report-aging', query, cell, projection),
    cutoff = closingAt(cell, query.cutoffDay),
    fifo = emptyFifo(),
    cutoffEnd = shiftDay(query.cutoffDay, 1) + ' 00:00:00';
  if (common.checkState === '不可验证' || !projection.chronological || (cell.events ?? []).some((event) => !event.localTime))
    markFifoUnknown(fifo);
  else
    for (const event of cell.events ?? []) {
      if (event.localTime! >= cutoffEnd) break;
      applyFifo(fifo, event, event.afterGrams);
    }
  const bins = ageBuckets(fifo, query.cutoffDay, cutoff.grams),
    agedGrams = bins.slice(0, 5).every((value) => value !== null)
      ? bins.slice(0, 5).reduce<number>((sum, value) => sum + value!, 0)
      : null,
    unagedGrams = cutoff.grams === null ? null : cutoff.grams - (agedGrams ?? 0),
    reasons = [...common.reasons];
  if (bins[5] !== 0 && cutoff.grams !== 0) reasons.push('FIFO 层证据不完整或不能与截止库存核对，剩余余额无法归龄');
  if (cutoff.grams === null) reasons.push('截止日余额缺少可靠边界，不填零');
  if (!projection.chronological) reasons.push('入账顺序与本地时间不单调，FIFO 年龄不可验证');
  return {
    ...common,
    cutoffDay: query.cutoffDay,
    closingPackages: cutoff.packages,
    closingGrams: cutoff.grams,
    age0To30Grams: bins[0]!,
    age31To90Grams: bins[1]!,
    age91To180Grams: bins[2]!,
    age181To365Grams: bins[3]!,
    ageOver365Grams: bins[4]!,
    unagedGrams,
    coverage: cutoff.grams && agedGrams !== null ? ((agedGrams / cutoff.grams) * 100).toFixed(2) + '%' : null,
    fifoBasis: agingBasis,
    checkState: reasons.length ? '不可验证' : common.checkState,
    reasons: reasons.slice(0, 12),
  };
}

export function derivedRows(
  kind: 'report-turnover' | 'report-aging',
  query: ReportTurnoverQuery | ReportAgingQuery,
  cells: Cell[],
  projection: Projection,
) {
  return kind === 'report-turnover'
    ? cells.map((cell) => turnoverRow(query as ReportTurnoverQuery, cell, projection))
    : cells.map((cell) => agingRow(query as ReportAgingQuery, cell, projection));
}
