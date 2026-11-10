import { keepPreviousData, useQuery } from '@tanstack/react-query';
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
  const state = useListState('warehouseCode', { scope: 'inventory' }, derivedReportDefaults(), ['source']),
    query = useQuery({ ...reportKeys.turnover(state.params), placeholderData: keepPreviousData }),
    report = query.data?.report;
  return (
    <BusinessList
      state={state}
      query={query}
      config={{
        name: 'report-turnover',
        title: '周转率',
        columns: turnoverColumns,
        description:
          '按净出库吨数 ÷ 完整日逐日日终平均库存计算；无流水日沿用前日日终余额。调减与盘亏计入余额但不计入出库分子。',
      }}
      filters={<ReportFilters state={state} derived />}
      summary={
        query.data &&
        report && (
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
        )
      }
    />
  );
}

export function ReportAging() {
  const defaults = derivedReportDefaults(true),
    state = useListState('warehouseCode', { scope: 'inventory' }, defaults, ['source']),
    query = useQuery({ ...reportKeys.aging(state.params), placeholderData: keepPreviousData }),
    report = query.data?.report;
  return (
    <BusinessList
      state={state}
      query={query}
      config={{
        name: 'report-aging',
        title: '库存库龄',
        columns: agingColumns,
        description: '截至所选日期，按先进先出计算剩余库存的存放天数；分五档展示，无法确定存放天数的数量单独列示。',
      }}
      filters={<ReportFilters state={state} aging derived />}
      summary={
        query.data &&
        report && (
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
        )
      }
    />
  );
}
