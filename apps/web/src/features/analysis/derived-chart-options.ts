import type { GlobalToken } from 'antd';
import type { Analysis } from '@wms/contracts';
import type { ChartOption } from '../../components/ui/chart-runtime';
import { chartAxis, chartBase, chartTheme } from '../reports/chart-theme';
import { chartTonnes } from '../reports/chart-options';
import { chartCopy as copy } from '../reports/chart-copy';
import { spacing } from '../../theme/design-tokens';

type TurnoverData = NonNullable<Analysis['turnover']['data']>;
type HeatmapData = NonNullable<Analysis['heatmap']['data']>;

export function turnoverOption(data: TurnoverData, token: GlobalToken): ChartOption {
  const colors = chartTheme(token);
  return {
    ...chartBase(token),
    xAxis: { ...chartAxis(token), type: 'category', data: data.map((point) => point.month) },
    yAxis: [
      { ...chartAxis(token), type: 'value', name: copy.turnoverTurns, position: 'left' },
      { ...chartAxis(token), type: 'value', name: copy.turnoverDays, position: 'right' },
    ],
    series: [
      {
        name: copy.turnoverTurns,
        type: 'line',
        yAxisIndex: 0,
        connectNulls: false,
        itemStyle: { color: colors.inbound },
        lineStyle: { color: colors.inbound },
        data: data.map((point) => (point.turns === null ? null : Number(point.turns))),
      },
      {
        name: copy.turnoverDays,
        type: 'line',
        yAxisIndex: 1,
        connectNulls: false,
        itemStyle: { color: colors.outbound },
        lineStyle: { color: colors.outbound },
        data: data.map((point) => (point.turnoverDays === null ? null : Number(point.turnoverDays))),
      },
    ],
    tooltip: {
      ...chartBase(token).tooltip,
      formatter: (params) => {
        const first = Array.isArray(params) ? params[0] : params,
          point = first && data[first.dataIndex];
        return point
          ? `${point.month}\n${copy.turnoverTurns}：${point.turns ?? copy.unknown}\n${copy.turnoverDays}：${point.turnoverDays ?? copy.unknown}\n${point.reasons.join('；')}`
          : '';
      },
    },
  };
}

export function heatmapOption(data: HeatmapData, token: GlobalToken): ChartOption {
  const colors = chartTheme(token),
    max = Math.max(1, ...data.days.map((point) => point.value ?? 0));
  const { grid: _grid, ...base } = chartBase(token);
  return {
    ...base,
    calendar: {
      top: spacing[24] * 3,
      left: spacing[16],
      right: spacing[24],
      bottom: spacing[16],
      range: [data.days[0]!.day, data.days.at(-1)!.day],
      cellSize: ['auto', 18],
      orient: 'horizontal',
      yearLabel: { show: false },
      monthLabel: { color: token.colorTextSecondary },
      dayLabel: { firstDay: 1, color: token.colorTextSecondary },
      itemStyle: { color: token.colorFillSecondary, borderWidth: 1, borderColor: token.colorBgContainer },
      splitLine: { lineStyle: { color: token.colorBorderSecondary } },
    },
    visualMap: {
      type: 'continuous',
      min: 0,
      max,
      left: 'center',
      top: 0,
      orient: 'horizontal',
      calculable: false,
      inRange: { color: colors.heatmap },
      textStyle: { color: token.colorTextSecondary },
    },
    series: [
      {
        type: 'heatmap',
        coordinateSystem: 'calendar',
        data: data.days.map((point) => [point.day, point.value]),
      },
    ],
    tooltip: {
      ...chartBase(token).tooltip,
      trigger: 'item',
      formatter: (params) => {
        const first = Array.isArray(params) ? params[0] : params,
          point = first && data.days[first.dataIndex];
        return point
          ? `${point.day}\n${copy.inbound}：${chartTonnes(point.inboundGrams)} ${copy.tonnes}\n${copy.outbound}：${chartTonnes(point.outboundGrams)} ${copy.tonnes}`
          : '';
      },
    },
  };
}
