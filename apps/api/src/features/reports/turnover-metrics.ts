import type { ReportTurnoverTotals, TurnoverMetrics } from '@wms/contracts';

export function turnoverMetrics(totals: ReportTurnoverTotals, days: number, reasons: string[]): TurnoverMetrics {
  const { netOutboundGrams: outbound, dailyClosingGramsSum: sum } = totals;
  const result: TurnoverMetrics = { ...totals, days, turns: null, turnoverDays: null, reasons: [...new Set(reasons)] };
  if (reasons.length) return result;
  if (!days) result.reasons.push('所选区间没有完整日');
  else if (outbound === null || sum === null) result.reasons.push('日终余额或净出库证据不足，无法计算');
  else if (sum <= 0) result.reasons.push('日终平均库存为零或异常，无法计算');
  else if (outbound < 0) result.reasons.push('本期撤销冲回大于出库，不适合计算周转');
  else {
    result.turns = (outbound / (sum / days)).toFixed(4);
    if (outbound === 0) result.reasons.push('无出库，周转天数无法估计');
    else result.turnoverDays = (sum / outbound).toFixed(1);
  }
  return result;
}
