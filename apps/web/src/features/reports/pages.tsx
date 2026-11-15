import { businessCopy } from '../../business-copy';
import { useQuery } from '@tanstack/react-query';
import { Link } from '@umijs/max';
import { businessLabels, type ReportDetailRow, type ReportMonthlyRow } from '@wms/contracts';
import { BusinessList } from '../../components/BusinessList';
import { useListState } from '../../components/BusinessList/use-list-state';
import { reportKeys } from './queries';
import { ReportFilters, reportDefaults } from './filters';
import { reportColumns } from './columns';
import { Reconciliation } from './reconciliation';
import { FileSearchOutlined, CalendarOutlined } from '@ant-design/icons';
import { ReportContextBar } from './context-bar';
import { ReportShell } from './report-shell';
import { ReportChartPanel } from './chart-panel';
import { reportDisplayQuery } from './display-query';
import { useSearchParams } from '@umijs/max';
import { reportInteractionCopy as copy } from './interaction-copy';
import { rowDrilldown } from './drilldown';
import { reportTableSummary } from './table-summary';

export function ReportDetails() {
  const [search] = useSearchParams();
  const state = useListState('postedAt', { scope: 'inventory' }, reportDefaults(), [
    'source',
    'drilldown',
    'sourceMovement',
  ]);
  const query = reportDisplayQuery(useQuery(reportKeys.details(state.params)));
  return (
    <BusinessList
      state={state}
      query={query}
      config={{
        name: 'report-details',
        title: '出入库明细',
        icon: <FileSearchOutlined />,
        layout: ReportShell,
        exportInHeader: true,
        columns: reportColumns<ReportDetailRow>('report-details', state.params),
        description: businessCopy.reportsDetailsBasis,
        extra: (
          <Link
            to={
              '/reports/monthly?' +
              new URLSearchParams({ ...state.params, movement: 'all', page: '1', sortBy: 'period' })
            }
          >
            {businessCopy.reportsPages1}
          </Link>
        ),
      }}
      filters={<ReportFilters state={state} detail facets={query.data?.facets} />}
      tableSummary={reportTableSummary('report-details', query.data)}
      beforeResults={
        <ReportContextBar
          view={query.isPlaceholderData ? undefined : query.data}
          basis={state.params.basis === 'restated' ? 'restated' : 'posted'}
          pending={query.isPending || query.isPlaceholderData}
          unavailable={Boolean(query.error) && !query.data}
        />
      }
      summary={
        <>
          {search.get('drilldown') === 'turnover' && <p>{copy.turnover}</p>}
          {(state.params.types ||
            state.params.movements ||
            (state.params.movement && state.params.movement !== 'all')) && <p>{copy.filteredReconciliation}</p>}
          <strong>{businessLabels.reportDates}</strong>
          <p>{businessLabels.reportExplanation}</p>
          {query.data && <Reconciliation report={query.data.report} />}
        </>
      }
    />
  );
}
export function ReportMonthly() {
  const state = useListState('period', { scope: 'inventory' }, reportDefaults('monthly'), [
    'source',
    'drilldown',
    'sourceMovement',
  ]);
  const query = reportDisplayQuery(useQuery(reportKeys.monthly(state.params)));
  return (
    <BusinessList
      state={state}
      query={query}
      config={{
        name: 'report-monthly',
        title: '月度汇总',
        icon: <CalendarOutlined />,
        layout: ReportShell,
        exportInHeader: true,
        columns: reportColumns<ReportMonthlyRow>('report-monthly', state.params),
        rowHref: (row) => rowDrilldown('report-monthly', state.params, row),
        chart: <ReportChartPanel kind="monthly" query={query} params={state.params} />,
        description: businessCopy.reportsMonthlyBasis,
        extra: (
          <Link to={'/reports/details?' + new URLSearchParams({ ...state.params, page: '1', sortBy: 'postedAt' })}>
            {businessCopy.reportsPages2}
          </Link>
        ),
      }}
      filters={<ReportFilters state={state} facets={query.data?.facets} />}
      tableSummary={reportTableSummary('report-monthly', query.data)}
      beforeResults={
        <ReportContextBar
          view={query.isPlaceholderData ? undefined : query.data}
          basis={state.params.basis === 'restated' ? 'restated' : 'posted'}
          pending={query.isPending || query.isPlaceholderData}
          unavailable={Boolean(query.error) && !query.data}
        />
      }
      summary={
        <>
          <strong>{businessLabels.reportDates}</strong>
          <p>{businessLabels.reportExplanation}</p>
          {query.data && <Reconciliation report={query.data.report} />}
        </>
      }
    />
  );
}
