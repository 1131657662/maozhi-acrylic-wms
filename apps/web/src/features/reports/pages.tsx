import { businessCopy } from '../../business-copy';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
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

const detailColumns = reportColumns<ReportDetailRow>('report-details');
const monthlyColumns = reportColumns<ReportMonthlyRow>('report-monthly');
export function ReportDetails() {
  const state = useListState('postedAt', { scope: 'inventory' }, reportDefaults(), ['source']);
  const query = useQuery({ ...reportKeys.details(state.params), placeholderData: keepPreviousData });
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
        columns: detailColumns,
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
      filters={<ReportFilters state={state} detail />}
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
export function ReportMonthly() {
  const state = useListState('period', { scope: 'inventory' }, reportDefaults(), ['source']);
  const query = useQuery({ ...reportKeys.monthly(state.params), placeholderData: keepPreviousData });
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
        columns: monthlyColumns,
        description: businessCopy.reportsMonthlyBasis,
        extra: (
          <Link to={'/reports/details?' + new URLSearchParams({ ...state.params, page: '1', sortBy: 'postedAt' })}>
            {businessCopy.reportsPages2}
          </Link>
        ),
      }}
      filters={<ReportFilters state={state} />}
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
