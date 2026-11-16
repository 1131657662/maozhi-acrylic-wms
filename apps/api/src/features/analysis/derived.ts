import {
  ANALYSIS,
  type AnalysisQuery,
  type ReportQuery,
  type ReportTurnoverQuery,
  type ReportAgingQuery,
  type ReportAgingRow,
} from '@wms/contracts';
import type { buildProjection } from '../reports/projection.ts';
import type { DatedEvent } from '../reports/restated-events.ts';
import { derivedRows } from '../reports/derived-rows.ts';
import { agingChart, turnoverChart } from '../reports/derived-chart.ts';

export function shiftMonth(day: string, offset: number): string {
  const date = new Date(`${day.slice(0, 7)}-01T00:00:00Z`);
  date.setUTCMonth(date.getUTCMonth() + offset);
  return date.toISOString().slice(0, 10);
}

export function projectionQuery(query: AnalysisQuery, fromDay: string): ReportQuery {
  return {
    scope: 'inventory',
    basis: query.basis,
    fromDay,
    toDay: query.toDay,
    warehouse: '',
    product: '',
    movement: 'all',
    page: 1,
    pageSize: 20,
    sortBy: 'postedAt',
    direction: 'asc',
  };
}

function derivedQuery(query: AnalysisQuery, fromDay: string): ReportTurnoverQuery {
  return {
    scope: 'inventory',
    basis: query.basis,
    fromDay,
    toDay: query.toDay,
    warehouse: '',
    product: '',
    page: 1,
    pageSize: 20,
    sortBy: 'warehouseCode',
    direction: 'asc',
  };
}

export function buildDerived(
  projection: Awaited<ReturnType<typeof buildProjection>>,
  query: AnalysisQuery,
  restated?: DatedEvent[],
) {
  const agingQuery = { ...derivedQuery(query, query.fromDay), cutoffDay: query.toDay } as ReportAgingQuery,
    agingRows = derivedRows('report-aging', agingQuery, [...projection.cells.values()], projection) as ReportAgingRow[],
    aging = agingChart(agingRows),
    turnoverStart = shiftMonth(query.toDay, -(ANALYSIS.turnoverMonths - 1)),
    turnoverQuery = derivedQuery(query, turnoverStart),
    turnover = turnoverChart({ query: turnoverQuery, projection, rows: [], restated });
  return { aging, turnover: turnover.points.slice(-ANALYSIS.turnoverMonths) };
}
