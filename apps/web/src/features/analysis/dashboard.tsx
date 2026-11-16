import { Alert, Button, Skeleton, Space } from 'antd';
import { BarChartOutlined, ReloadOutlined } from '@ant-design/icons';
import type { AnalysisQuery } from '@wms/contracts';
import { PageShell } from '../../components/ui/PageShell';
import { spacing } from '../../theme/design-tokens';
import { defaultAnalysisRange } from './date-range';
import { dashboardCopy as copy } from './dashboard-copy';
import { DashboardFilters, useDashboardFilterState } from './dashboard-filters';
import { useAnalysis } from './use-analysis';
import { TrendSection, ComparisonSection } from './movement-sections';
import { TopSection } from './top-section';
import { AgingSection, TurnoverSection, HeatmapSection } from './derived-sections';
import { DurationSection } from './duration-section';

const LOADING_SECTIONS = ['trend', 'comparison', 'tops', 'aging', 'turnover', 'heatmap', 'duration'] as const;

function LoadingSections() {
  return (
    <Space orientation="vertical" size={spacing[16]} style={{ display: 'flex' }}>
      {LOADING_SECTIONS.map((section) => (
        <Skeleton active key={section} paragraph={{ rows: 3 }} />
      ))}
    </Space>
  );
}

function AnalysisContent({ query }: { query: NonNullable<ReturnType<typeof useAnalysis>['data']> }) {
  return (
    <Space orientation="vertical" size={spacing[16]} style={{ display: 'flex' }} data-testid="analysis-content">
      <TrendSection block={query.monthly} />
      <ComparisonSection block={query.comparison} />
      <TopSection block={query.tops} />
      <AgingSection block={query.aging} />
      <TurnoverSection block={query.turnover} />
      <HeatmapSection block={query.heatmap} />
      <DurationSection block={query.duration} />
    </Space>
  );
}

function fallbackQuery(basis: AnalysisQuery['basis']): AnalysisQuery {
  const [fromDay, toDay] = defaultAnalysisRange();
  return { fromDay, toDay, basis };
}

function QueryStatus({ onRetry }: { onRetry: () => void }) {
  return (
    <Alert
      type="error"
      showIcon
      title={copy.dataFailed}
      action={
        <Button icon={<ReloadOutlined />} onClick={onRetry}>
          {copy.retry}
        </Button>
      }
    />
  );
}

export function AnalysisDashboard() {
  const filters = useDashboardFilterState(),
    query = useAnalysis(filters.query ?? fallbackQuery(filters.basis), Boolean(filters.query));
  return (
    <PageShell title={copy.title} icon={<BarChartOutlined />}>
      <Space orientation="vertical" size={spacing[16]} style={{ display: 'flex' }} data-testid="analysis-dashboard">
        <DashboardFilters state={filters} />
        {filters.query && query.isError && <QueryStatus onRetry={() => void query.refetch()} />}
        {filters.query && query.data && <AnalysisContent query={query.data} />}
        {filters.query && query.isPending && <LoadingSections />}
      </Space>
    </PageShell>
  );
}
