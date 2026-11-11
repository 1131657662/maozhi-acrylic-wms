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
        columns: detailColumns,
        description: '按入账日追溯收发与撤销补偿。方向仅筛选明细，下方对账始终包含同仓品日期范围的全部收发与调整。',
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
        columns: monthlyColumns,
        description:
          '按仓库 × 库存商品 × 入账月份核对。部分月份按所选日期截取；入出库净额含撤销，期初/期末不跨月相加。列设置可展开各类调整及补偿。',
        extra: (
          <Link to={'/reports/details?' + new URLSearchParams({ ...state.params, page: '1', sortBy: 'postedAt' })}>
            {businessCopy.reportsPages2}
          </Link>
        ),
      }}
      filters={<ReportFilters state={state} />}
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
