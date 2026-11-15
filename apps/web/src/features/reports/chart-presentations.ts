import type { GlobalToken } from 'antd';
import type { ReportMonthlyChart, ReportTurnoverChart, ReportAgingChart } from '@wms/contracts';
import { monthlyOption, turnoverOption, agingOption, chartTonnes } from './chart-options';
import { chartCopy as copy } from './chart-copy';

export function monthlyPresentation(chart: ReportMonthlyChart | undefined, token: GlobalToken) {
  const totals = chart?.totals;
  return {
    title: copy.monthly,
    option: chart ? monthlyOption(chart, token) : null,
    unavailable: false,
    description:
      chart?.points
        .map(
          (p) =>
            `${p.month} ${copy.inbound} ${chartTonnes(p.inboundGrams)} ${copy.outbound} ${chartTonnes(p.outboundGrams)} ${copy.net} ${chartTonnes(p.netGrams)} ${copy.tonnes}`,
        )
        .join('；') ?? '',
    stats: [
      {
        label: `${copy.inbound}（${copy.tonnes}）`,
        value: chartTonnes(totals?.inboundGrams ?? null),
        formula: copy.inboundFormula,
      },
      {
        label: `${copy.outbound}（${copy.tonnes}）`,
        value: chartTonnes(totals?.outboundGrams ?? null),
        formula: copy.outboundFormula,
      },
      {
        label: `${copy.net}（${copy.tonnes}）`,
        value: chartTonnes(totals?.netGrams ?? null),
        formula: copy.netFormula,
      },
    ],
  };
}
export function turnoverPresentation(chart: ReportTurnoverChart | undefined, token: GlobalToken) {
  return {
    title: copy.turnover,
    option: chart ? turnoverOption(chart, token) : null,
    unavailable: chart?.points.every((point) => point.turnoverDays === null) ?? false,
    description: chart?.points.map((p) => `${p.month} ${p.turnoverDays ?? copy.unknown} ${copy.days}`).join('；') ?? '',
    stats: [
      {
        label: `${copy.turnoverTurns}（${copy.turns}）`,
        value: chart?.totals.turns ?? copy.unknown,
        formula: copy.turnsFormula,
      },
      {
        label: `${copy.turnoverDays}（${copy.days}）`,
        value: chart?.totals.turnoverDays ?? copy.unknown,
        formula: copy.daysFormula,
      },
    ],
  };
}
export function agingPresentation(chart: ReportAgingChart | undefined, token: GlobalToken) {
  return {
    title: copy.aging,
    option: chart ? agingOption(chart, token) : null,
    unavailable: chart?.closingGrams === null,
    description: chart
      ? [...chart.buckets, chart.unagedGrams]
          .map((value, i) => `${[...copy.buckets, copy.unaged][i]} ${chartTonnes(value)} ${copy.tonnes}`)
          .join('；')
      : '',
    stats: [
      {
        label: `${copy.closing}（${copy.tonnes}）`,
        value: chartTonnes(chart?.closingGrams ?? null),
        formula: copy.closingFormula,
      },
      {
        label: copy.over90,
        value: chart?.over90Percent == null ? copy.unknown : `${chart.over90Percent}%`,
        formula: copy.over90Formula,
      },
      {
        label: `${copy.unaged}（${copy.tonnes}）`,
        value: chartTonnes(chart?.unagedGrams ?? null),
        formula: copy.unagedFormula,
      },
    ],
  };
}
