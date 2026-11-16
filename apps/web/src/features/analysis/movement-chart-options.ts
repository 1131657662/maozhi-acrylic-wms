import type { GlobalToken } from 'antd';
import type { Analysis } from '@wms/contracts';
import type { ChartOption } from '../../components/ui/chart-runtime';
import { chartAxis, chartBase, chartTheme } from '../reports/chart-theme';
import { chartTonnes } from '../reports/chart-options';
import { chartCopy as copy } from '../reports/chart-copy';

type MonthlyData = NonNullable<Analysis['monthly']['data']>;
type ComparisonData = NonNullable<Analysis['comparison']['data']>;
type TopData = NonNullable<Analysis['tops']['data']>['products'];
const tonnesValue = (grams: number | null) => (grams === null ? null : grams / 1_000_000);

export function trendOption(data: MonthlyData, token: GlobalToken): ChartOption {
  const colors = chartTheme(token);
  return {
    ...chartBase(token),
    xAxis: { ...chartAxis(token), type: 'category', data: data.points.map((point) => point.month) },
    yAxis: { ...chartAxis(token), type: 'value', name: copy.tonnes },
    series: [
      {
        name: copy.inbound,
        type: 'line',
        connectNulls: false,
        itemStyle: { color: colors.inbound },
        lineStyle: { color: colors.inbound },
        areaStyle: { color: colors.inbound, opacity: 0.1 },
        data: data.points.map((point) => tonnesValue(point.inboundGrams)),
      },
      {
        name: copy.outbound,
        type: 'line',
        connectNulls: false,
        itemStyle: { color: colors.outbound },
        lineStyle: { color: colors.outbound },
        areaStyle: { color: colors.outbound, opacity: 0.1 },
        data: data.points.map((point) => tonnesValue(point.outboundGrams)),
      },
    ],
    tooltip: {
      ...chartBase(token).tooltip,
      formatter: (params) => {
        const first = Array.isArray(params) ? params[0] : params,
          point = first && data.points[first.dataIndex];
        return point
          ? `${point.month}\n${copy.inbound}：${chartTonnes(point.inboundGrams)} ${copy.tonnes}\n${copy.outbound}：${chartTonnes(point.outboundGrams)} ${copy.tonnes}`
          : '';
      },
    },
  };
}

export function compareOption(data: ComparisonData, token: GlobalToken): ChartOption {
  const colors = chartTheme(token),
    labels = ['本期', '对比期'];
  return {
    ...chartBase(token),
    xAxis: { ...chartAxis(token), type: 'category', data: labels },
    yAxis: { ...chartAxis(token), type: 'value', name: copy.tonnes },
    series: [
      {
        name: copy.inbound,
        type: 'bar',
        itemStyle: { color: colors.inbound },
        data: [data.current, data.previous].map((item) => tonnesValue(item.inboundGrams)),
      },
      {
        name: copy.outbound,
        type: 'bar',
        itemStyle: { color: colors.outbound },
        data: [data.current, data.previous].map((item) => tonnesValue(item.outboundGrams)),
      },
    ],
    tooltip: {
      ...chartBase(token).tooltip,
      formatter: (params) => {
        const first = Array.isArray(params) ? params[0] : params,
          item = first?.dataIndex === 1 ? data.previous : data.current;
        return `${item.fromDay} ~ ${item.toDay}\n${copy.inbound}：${chartTonnes(item.inboundGrams)} ${copy.tonnes}\n${copy.outbound}：${chartTonnes(item.outboundGrams)} ${copy.tonnes}`;
      },
    },
  };
}

export function topOption(data: TopData, token: GlobalToken): ChartOption {
  const colors = chartTheme(token);
  return {
    ...chartBase(token),
    grid: { ...chartBase(token).grid, left: token.paddingLG, right: token.paddingLG },
    xAxis: { ...chartAxis(token), type: 'value', name: copy.tonnes },
    yAxis: {
      ...chartAxis(token),
      type: 'category',
      inverse: true,
      data: data.map((item) => item.code),
      axisLabel: { color: token.colorTextSecondary, width: token.fontSize * 12, overflow: 'truncate' },
    },
    series: [
      {
        name: copy.outbound,
        type: 'bar',
        itemStyle: { color: colors.outbound },
        data: data.map((item) => tonnesValue(item.rankedGrams)),
      },
    ],
    tooltip: {
      ...chartBase(token).tooltip,
      formatter: (params) => {
        const first = Array.isArray(params) ? params[0] : params,
          item = first && data[first.dataIndex];
        return item
          ? `${item.code}\n${copy.inbound}：${chartTonnes(item.inboundGrams)} ${copy.tonnes}\n${copy.outbound}：${chartTonnes(item.outboundGrams)} ${copy.tonnes}`
          : '';
      },
    },
  };
}
