import { theme } from 'antd';
import type { ReportMonthlyChart, ReportTurnoverChart, ReportAgingChart } from '@wms/contracts';
import { Card, Chart } from '../../components/ui';
import { spacing } from '../../theme/design-tokens';
import { ReportStatCards } from './chart-cards';
import { monthlyPresentation, turnoverPresentation, agingPresentation } from './chart-presentations';
import { chartCopy as copy } from './chart-copy';

interface ChartQuery<C> {
  data?: { chart: C; viewToken: string };
  isPending: boolean;
  error: Error | null;
}
type Props =
  | { kind: 'monthly'; query: ChartQuery<ReportMonthlyChart> }
  | { kind: 'turnover'; query: ChartQuery<ReportTurnoverChart> }
  | { kind: 'aging'; query: ChartQuery<ReportAgingChart> };

export function ReportChartPanel(props: Props) {
  const { token } = theme.useToken();
  const presentation =
    props.kind === 'monthly'
      ? monthlyPresentation(props.query.data?.chart, token)
      : props.kind === 'turnover'
        ? turnoverPresentation(props.query.data?.chart, token)
        : agingPresentation(props.query.data?.chart, token);
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
      <ReportStatCards stats={presentation.stats} />
      <Card title={presentation.title}>
        <Chart option={presentation.option} state={state} message={message} description={presentation.description} />
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
