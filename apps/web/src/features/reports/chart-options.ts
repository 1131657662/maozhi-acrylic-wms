import type { GlobalToken } from 'antd';
import { tonnes, type ReportMonthlyChart, type ReportTurnoverChart, type ReportAgingChart } from '@wms/contracts';
import type { ChartOption } from '../../components/ui/chart-runtime';
import { chartAxis, chartBase, chartTheme } from './chart-theme';
import { chartCopy as copy } from './chart-copy';

const tons = (grams: number | null) => (grams === null ? null : grams / 1_000_000);
export const chartTonnes = (grams: number | null) => (grams === null ? copy.unknown : tonnes(grams));

export function monthlyOption(chart: ReportMonthlyChart, token: GlobalToken): ChartOption {
  const colors = chartTheme(token);
  return {
    ...chartBase(token),
    xAxis: { ...chartAxis(token), type: 'category', data: chart.points.map((point) => point.month) },
    yAxis: { ...chartAxis(token), type: 'value', name: copy.tonnes },
    series: [
      {
        name: copy.inbound,
        type: 'bar',
        itemStyle: { color: colors.inbound },
        data: chart.points.map((point) => tons(point.inboundGrams)),
      },
      {
        name: copy.outbound,
        type: 'bar',
        itemStyle: { color: colors.outbound },
        data: chart.points.map((point) => tons(point.outboundGrams)),
      },
      {
        name: copy.net,
        type: 'line',
        itemStyle: { color: colors.net },
        lineStyle: { color: colors.net },
        data: chart.points.map((point) => tons(point.netGrams)),
      },
    ],
    tooltip: {
      ...chartBase(token).tooltip,
      formatter: (params) => {
        const first = Array.isArray(params) ? params[0] : params;
        const point = first && chart.points[first.dataIndex];
        return point
          ? `${point.month}\n${copy.inbound}：${chartTonnes(point.inboundGrams)} ${copy.tonnes} · ${point.inboundPackages} ${copy.packages} · ${point.inboundDocuments ?? copy.unknown} ${copy.documents}\n${copy.outbound}：${chartTonnes(point.outboundGrams)} ${copy.tonnes} · ${point.outboundPackages} ${copy.packages} · ${point.outboundDocuments ?? copy.unknown} ${copy.documents}\n${copy.net}：${chartTonnes(point.netGrams)} ${copy.tonnes}`
          : '';
      },
    },
  };
}

export function turnoverOption(chart: ReportTurnoverChart, token: GlobalToken): ChartOption {
  return {
    ...chartBase(token),
    xAxis: { ...chartAxis(token), type: 'category', data: chart.points.map((point) => point.month) },
    yAxis: { ...chartAxis(token), type: 'value', name: copy.days },
    series: [
      {
        name: copy.turnoverDays,
        type: 'line',
        connectNulls: false,
        itemStyle: { color: token.colorPrimary },
        lineStyle: { color: token.colorPrimary },
        data: chart.points.map((point) => (point.turnoverDays === null ? null : Number(point.turnoverDays))),
      },
    ],
    tooltip: {
      ...chartBase(token).tooltip,
      formatter: (params) => {
        const first = Array.isArray(params) ? params[0] : params;
        const point = first && chart.points[first.dataIndex];
        return point
          ? `${point.fromDay} ~ ${point.toDay}\n${copy.turnoverDays}：${point.turnoverDays ?? copy.unknown}\n${copy.outbound}：${chartTonnes(point.netOutboundGrams)} ${copy.tonnes}\n${point.reasons.join('；')}`
          : '';
      },
    },
  };
}

export function agingOption(chart: ReportAgingChart, token: GlobalToken): ChartOption {
  const colors = chartTheme(token);
  const values = [...chart.buckets, chart.unagedGrams];
  return {
    ...chartBase(token),
    xAxis: { ...chartAxis(token), type: 'value', name: copy.tonnes },
    yAxis: { ...chartAxis(token), type: 'category', data: [copy.distribution] },
    series: [...copy.buckets, copy.unaged].map((name, index) => ({
      name,
      type: 'bar',
      stack: 'stock',
      itemStyle: { color: [...colors.ages, colors.unaged][index] },
      data: [tons(values[index] ?? null)],
    })),
  };
}
