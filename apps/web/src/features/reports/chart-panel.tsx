import { useMemo } from 'react';
import { theme } from 'antd';
import type { ReportMonthlyChart, ReportTurnoverChart, ReportAgingChart } from '@wms/contracts';
import { Card, Chart } from '../../components/ui';
import { spacing } from '../../theme/design-tokens';
import { ReportStatCards } from './chart-cards';
import { monthlyPresentation, turnoverPresentation, agingPresentation } from './chart-presentations';
import { chartCopy as copy } from './chart-copy';
import type { ListParams } from '../web-lists/keys';
import { cardDrilldown, chartDrilldown, openReport } from './drilldown';

interface ChartQuery<C> {
  data?: { chart: C; viewToken: string };
  isPending: boolean;
  error: Error | null;
}
type Props =
  | { kind: 'monthly'; query: ChartQuery<ReportMonthlyChart> }
  | { kind: 'turnover'; query: ChartQuery<ReportTurnoverChart> }
  | { kind: 'aging'; query: ChartQuery<ReportAgingChart> };

export function ReportChartPanel(props: Props & { params: ListParams }) {
  const { token } = theme.useToken();
  const chart = props.query.data?.chart,
    paramsKey = JSON.stringify(props.params),
    presentation = useMemo(
      () =>
        props.kind === 'monthly'
          ? monthlyPresentation(chart as ReportMonthlyChart | undefined, token)
          : props.kind === 'turnover'
            ? turnoverPresentation(chart as ReportTurnoverChart | undefined, token)
            : agingPresentation(chart as ReportAgingChart | undefined, token),
      [props.kind, chart, token],
    ),
    onPointClick = useMemo(
      () => (event: { name: string; seriesIndex?: number }) =>
        openReport(chartDrilldown(props.kind, props.params, event)),
      [props.kind, paramsKey],
    );
  const { query } = props;
  const state = query.error
    ? 'error'
    : query.isPending || !query.data
      ? 'loading'
      : query.data.chart.empty
        ? 'empty'
        : presentation.unavailable
          ? 'unverifiable'
          : 'ready';
  const message = state === 'ready' ? '' : copy[state];
  return (
    <div
      data-testid="report-visualization"
      data-view-token={query.data?.viewToken}
      style={{ display: 'grid', gap: spacing[16], minWidth: 0 }}
    >
      <ReportStatCards
        stats={presentation.stats}
        hrefs={
          query.data ? presentation.stats.map((_, index) => cardDrilldown(props.kind, props.params, index)) : undefined
        }
      />
      <Card title={presentation.title}>
        <Chart
          option={presentation.option}
          state={state}
          message={message}
          description={presentation.description}
          onPointClick={onPointClick}
        />
        {!!query.data?.chart.reasons.length && (
          <details data-testid="chart-reasons">
            <summary>{copy.unverifiable}</summary>
            <ul>
              {query.data.chart.reasons.map((reason) => (
                <li key={reason}>{reason}</li>
              ))}
            </ul>
          </details>
        )}
      </Card>
    </div>
  );
}
