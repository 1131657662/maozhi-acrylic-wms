import { useQuery } from '@tanstack/react-query';
import type { ReportAgingRow, ReportTurnoverRow } from '@wms/contracts';
import { BusinessList } from '../../components/BusinessList';
import { useListState } from '../../components/BusinessList/use-list-state';
import { derivedReportDefaults, ReportFilters } from './filters';
import { reportColumns } from './columns';
import { DerivedSummary } from './derived-summary';
import { Reconciliation } from './reconciliation';
import { reportKeys } from './queries';
import { LineChartOutlined, DatabaseOutlined } from '@ant-design/icons';
import { ReportContextBar } from './context-bar';
import { ReportShell } from './report-shell';
import { ReportChartPanel } from './chart-panel';
import { reportDisplayQuery } from './display-query';
import { rowDrilldown } from './drilldown';
import { reportTableSummary } from './table-summary';

export function ReportTurnover() {
  const state = useListState('warehouseCode', { scope: 'inventory' }, derivedReportDefaults(), [
      'source',
      'sourceMovement',
      'drilldown',
    ]),
    query = reportDisplayQuery(useQuery(reportKeys.turnover(state.params))),
    report = query.data?.report;
  return (
    <BusinessList
      state={state}
      query={query}
      config={{
        name: 'report-turnover',
        title: '周转率',
        icon: <LineChartOutlined />,
        layout: ReportShell,
        exportInHeader: true,
        columns: reportColumns<ReportTurnoverRow>('report-turnover', state.params),
        rowHref: (row) => rowDrilldown('report-turnover', state.params, row),
        chart: <ReportChartPanel kind="turnover" query={query} params={state.params} />,
        description:
          '按净出库吨数 ÷ 完整日逐日日终平均库存计算；无流水日沿用前日日终余额。调减与盘亏计入余额但不计入出库分子。',
      }}
      filters={<ReportFilters state={state} derived facets={query.data?.facets} />}
      tableSummary={reportTableSummary('report-turnover', query.data)}
      beforeResults={
        <ReportContextBar
          view={query.isPlaceholderData ? undefined : query.data}
          basis={state.params.basis === 'restated' ? 'restated' : 'posted'}
          pending={query.isPending || query.isPlaceholderData}
          unavailable={Boolean(query.error) && !query.data}
        />
      }
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
    state = useListState('warehouseCode', { scope: 'inventory' }, defaults, ['source', 'sourceMovement', 'drilldown']),
    query = reportDisplayQuery(useQuery(reportKeys.aging(state.params))),
    report = query.data?.report;
  return (
    <BusinessList
      state={state}
      query={query}
      config={{
        name: 'report-aging',
        title: '库存库龄',
        icon: <DatabaseOutlined />,
        layout: ReportShell,
        exportInHeader: true,
        columns: reportColumns<ReportAgingRow>('report-aging', state.params),
        rowHref: (row) => rowDrilldown('report-aging', state.params, row),
        chart: <ReportChartPanel kind="aging" query={query} params={state.params} />,
        description: '截至所选日期，按先进先出计算剩余库存的存放天数；分五档展示，无法确定存放天数的数量单独列示。',
      }}
      filters={<ReportFilters state={state} aging derived facets={query.data?.facets} />}
      tableSummary={reportTableSummary('report-aging', query.data)}
      beforeResults={
        <ReportContextBar
          view={query.isPlaceholderData ? undefined : query.data}
          basis={state.params.basis === 'restated' ? 'restated' : 'posted'}
          pending={query.isPending || query.isPlaceholderData}
          unavailable={Boolean(query.error) && !query.data}
        />
      }
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
