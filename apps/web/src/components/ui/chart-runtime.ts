import { init, use, type ComposeOption } from 'echarts/core';
import { LineChart, BarChart, type LineSeriesOption, type BarSeriesOption } from 'echarts/charts';
import {
  GridComponent,
  TooltipComponent,
  LegendComponent,
  type GridComponentOption,
  type TooltipComponentOption,
  type LegendComponentOption,
} from 'echarts/components';
import { CanvasRenderer } from 'echarts/renderers';

use([LineChart, BarChart, GridComponent, TooltipComponent, LegendComponent, CanvasRenderer]);
export { init };
export type ChartOption = ComposeOption<
  LineSeriesOption | BarSeriesOption | GridComponentOption | TooltipComponentOption | LegendComponentOption
>;
