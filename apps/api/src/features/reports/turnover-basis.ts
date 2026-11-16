import type { ReportTurnoverQuery } from '@wms/contracts';
import type { Cell, Projection } from './types.ts';
import type { DatedEvent } from './restated-events.ts';
import { snapshotPeriod, stateReasons, dailyBalances } from './derived-common.ts';
import { turnoverMovements } from './turnover-movements.ts';
import { reportCopy } from './copy.ts';

export function turnoverBasis(query: ReportTurnoverQuery, cell: Cell, projection: Projection, restated?: DatedEvent[]) {
  const period = snapshotPeriod(query, projection),
    common = { reasons: stateReasons(cell), checkState: cell.periods.get('range')!.checkState },
    balances = projection.chronological ? dailyBalances(cell, period.days) : { completeDays: 0, sumGrams: null },
    netOutboundGrams = turnoverMovements(cell, { fromDay: query.fromDay, throughDay: period.throughDay }, restated),
    reasons = [...common.reasons];
  if (!projection.chronological) reasons.push('入账顺序与本地时间不单调，逐日余额不可验证');
  if (balances.completeDays !== period.days.length)
    reasons.push(`逐日日终余额仅 ${balances.completeDays}/${period.days.length} 日可验证`);
  if (common.checkState === '不可验证') balances.sumGrams = null;
  if (netOutboundGrams === null) reasons.push(reportCopy.unknownRestatedOutbound);
  else if (netOutboundGrams < 0) reasons.push('本期出库撤销冲回大于出库确认，不适合计算周转');
  const averageGrams =
      balances.sumGrams === null || !period.days.length ? null : balances.sumGrams / period.days.length,
    turns =
      averageGrams !== null && averageGrams > 0 && netOutboundGrams !== null && netOutboundGrams >= 0
        ? netOutboundGrams / averageGrams
        : null,
    turnoverDays =
      averageGrams !== null && averageGrams > 0 && netOutboundGrams !== null && netOutboundGrams > 0
        ? (period.days.length * averageGrams) / netOutboundGrams
        : null;
  return { period, balances, netOutboundGrams, reasons, averageGrams, turns, turnoverDays };
}

export function turnoverChartRow(
  query: ReportTurnoverQuery,
  cell: Cell,
  projection: Projection,
  restated?: DatedEvent[],
) {
  const { balances, netOutboundGrams, reasons } = turnoverBasis(query, cell, projection, restated);
  return {
    netOutboundGrams: projection.chronological ? netOutboundGrams : null,
    dailyClosingGramsSum: balances.sumGrams,
    reasons,
  };
}
