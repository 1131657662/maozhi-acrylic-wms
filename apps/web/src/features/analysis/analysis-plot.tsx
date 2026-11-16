import { lazy, Suspense } from 'react';
import { componentSize } from '../../theme/design-tokens';
import { AfterPaint } from '../workbench/after-paint';
import { chartCopy } from '../reports/chart-copy';
import { chartState, type AnalysisBlock } from './analysis-section';
import type { ChartOption } from '../../components/ui/chart-runtime';

const Chart = lazy(() => import('../../components/ui/Chart').then((module) => ({ default: module.Chart })));

export function AnalysisPlot({
  block,
  option,
  description,
  hasVisibleData,
  onPointClick,
}: {
  block: AnalysisBlock<unknown>;
  option: ChartOption | null;
  description: string;
  hasVisibleData: boolean;
  onPointClick?: (event: { name: string; seriesIndex?: number; dataIndex?: number }) => void;
}) {
  const state = chartState(block, hasVisibleData),
    message = state === 'ready' ? '' : chartCopy[state],
    height = state === 'ready' ? componentSize.reportChart : componentSize.compactEmpty;
  return (
    <AfterPaint>
      <Suspense fallback={null}>
        <Chart
          option={option}
          state={state}
          message={message}
          description={description}
          height={height}
          onPointClick={onPointClick}
        />
      </Suspense>
    </AfterPaint>
  );
}
