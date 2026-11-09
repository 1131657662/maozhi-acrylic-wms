import { useQuery } from '@tanstack/react-query';
import type { ReportAgingRow, ReportTurnoverRow } from '@wms/contracts';
import { BusinessList } from '../../components/BusinessList';
import { useListState } from '../../components/BusinessList/use-list-state';
import { derivedReportDefaults, ReportFilters } from './filters';
import { reportColumns } from './columns';
import { DerivedSummary } from './derived-summary';
import { Reconciliation } from './reconciliation';
import { reportKeys } from './queries';

const turnoverColumns = reportColumns<ReportTurnoverRow>('report-turnover');
const agingColumns = reportColumns<ReportAgingRow>('report-aging');

export function ReportTurnover() {
  const state = useListState('warehouseCode', { source: 'erp-product' }, derivedReportDefaults()),
    query = useQuery(reportKeys.turnover(state.params)),
    report = query.data?.report;
  return (
    <BusinessList
      state={state}
      query={query}
      config={{
        name: 'report-turnover',
        title: '周转率',
        columns: turnoverColumns,
        description: '按净出库吨数 ÷ 完整日逐日日终平均库存计算；无流水日沿用前日日终余额。调减与盘亏计入余额但不计入出库分子。',
      }}
      filters={<ReportFilters state={state} derived />}
      summary={query.data && report && (
        <>
          <DerivedSummary
            kind="turnover"
            totals={query.data.totals}
            fromDay={report.fromDay}
            toDay={report.toDay}
            adjustmentCount={report.adjustmentCount}
            stocktakeCount={report.stocktakeCount}
            incomplete={report.scopeStatus === 'incomplete'}
          />
          <Reconciliation report={report} />
        </>
      )}
    />
  );
}

export function ReportAging() {
  const defaults = derivedReportDefaults(true),
    state = useListState('warehouseCode', { source: 'erp-product' }, defaults),
    query = useQuery(reportKeys.aging(state.params)),
    report = query.data?.report;
  return (
    <BusinessList
      state={state}
      query={query}
      config={{
        name: 'report-aging',
        title: '库存库龄',
        columns: agingColumns,
        description: '截止日按入账顺序重放吨数 FIFO；年龄分五档，无法归龄余额单独列示，不推算包数分桶。',
      }}
      filters={<ReportFilters state={state} aging derived />}
      summary={query.data && report && (
        <>
          <DerivedSummary
            kind="aging"
            totals={query.data.totals}
            cutoffDay={state.params.cutoffDay ?? defaults.cutoffDay}
            fromDay={report.fromDay}
            toDay={report.toDay}
            adjustmentCount={report.adjustmentCount}
            stocktakeCount={report.stocktakeCount}
            incomplete={report.scopeStatus === 'incomplete'}
          />
          <Reconciliation report={report} />
        </>
      )}
    />
  );
}
