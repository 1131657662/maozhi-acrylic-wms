import { init, use, type ComposeOption } from 'echarts/core';
import {
  LineChart,
  BarChart,
  HeatmapChart,
  type LineSeriesOption,
  type BarSeriesOption,
  type HeatmapSeriesOption,
} from 'echarts/charts';
import {
  GridComponent,
  TooltipComponent,
  LegendComponent,
  CalendarComponent,
  VisualMapComponent,
  type GridComponentOption,
  type TooltipComponentOption,
  type LegendComponentOption,
  type CalendarComponentOption,
  type VisualMapComponentOption,
} from 'echarts/components';
import { CanvasRenderer } from 'echarts/renderers';

use([
  LineChart,
  BarChart,
  HeatmapChart,
  GridComponent,
  TooltipComponent,
  LegendComponent,
  CalendarComponent,
  VisualMapComponent,
  CanvasRenderer,
]);
export { init };
export type ChartOption = ComposeOption<
  | LineSeriesOption
  | BarSeriesOption
  | HeatmapSeriesOption
  | GridComponentOption
  | TooltipComponentOption
  | LegendComponentOption
  | CalendarComponentOption
  | VisualMapComponentOption
>;
