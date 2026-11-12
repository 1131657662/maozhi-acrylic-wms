import type { ReportAgingQuery, ReportAgingRow, ReportTurnoverQuery, ReportTurnoverRow } from '@wms/contracts';
import type { Database } from '../../db/mysql.ts';
import { AppError } from '../../shared/errors.ts';
import { hash } from '../../shared/hash.ts';
import { pageResult } from '../web-lists/query.ts';
import { buildProjection } from './projection.ts';
import { snapshotPeriod, derivedMeta, periodCounts } from './derived-common.ts';
import { derivedRows } from './derived-rows.ts';
import { agingTotals, turnoverTotals } from './derived-totals.ts';
import { reportSnapshot, rememberReportSnapshot, reportQueryFingerprint } from './snapshot.ts';
import { buildRestatement, postedView, type Restatement } from './restated.ts';

type DerivedQuery = ReportTurnoverQuery | ReportAgingQuery;
type DerivedRow = ReportTurnoverRow | ReportAgingRow;

function projectionQuery(query: DerivedQuery) {
  return {
    basis: query.basis,
    asOf: query.asOf,
    source: query.source,
    scope: query.scope,
    fromDay: query.fromDay,
    toDay: query.toDay,
    warehouse: query.warehouse,
    product: query.product,
    movement: 'all' as const,
    page: query.page,
    pageSize: query.pageSize,
    sortBy: 'postedAt' as const,
    direction: 'asc' as const,
  };
}

function sortRows(rows: DerivedRow[], query: DerivedQuery): DerivedRow[] {
  const direction = query.direction === 'asc' ? 1 : -1,
    key = query.sortBy;
  return [...rows].sort((a, b) => {
    const left = (a as unknown as Record<string, unknown>)[key],
      right = (b as unknown as Record<string, unknown>)[key];
    return (
      direction *
      (String(left).localeCompare(String(right)) ||
        a.warehouseCode.localeCompare(b.warehouseCode) ||
        a.productCode.localeCompare(b.productCode))
    );
  });
}

function reportMeta(
  kind: 'report-turnover' | 'report-aging',
  query: DerivedQuery,
  rows: DerivedRow[],
  projection: Awaited<ReturnType<typeof buildProjection>>,
) {
  const period = snapshotPeriod(query, projection),
    countToDay = period.throughDay,
    counts = periodCounts(
      [...projection.cells.values()].flatMap((cell) => cell.events ?? []),
      query.fromDay,
      countToDay,
    ),
    completeDays = rows.length
      ? Math.min(...rows.map((row) => ('completeDays' in row ? row.completeDays : period.days.length)))
      : 0;
  return derivedMeta(projection, {
    fromDay: query.fromDay,
    toDay: query.toDay,
    countFromDay: query.fromDay,
    countToDay,
    days: period.days.length,
    completeDays,
    incomplete: period.incomplete,
    formula:
      kind === 'report-turnover'
        ? 'R = O / M；T = D × M / O；M = ΣQ(d) / D'
        : '吨数 FIFO；0–30 / 31–90 / 91–180 / 181–365 / >365；不能归龄的余额独立列示',
    adjustmentCount: counts.adjustmentCount,
    stocktakeCount: counts.stocktakeCount,
  });
}

function validateDates(kind: 'report-turnover' | 'report-aging', query: DerivedQuery): void {
  const today = new Date(Date.now() + 8 * 3600000).toISOString().slice(0, 10),
    cutoff = kind === 'report-aging' ? (query as ReportAgingQuery).cutoffDay : query.toDay;
  if (query.toDay > today || cutoff > today)
    throw new AppError('REPORT_FUTURE', '不能将未来日期视为已入账区间，请选择今天或更早的截止日', 422);
}

export function derivedReportReader(
  kind: 'report-turnover' | 'report-aging',
  query: DerivedQuery,
  exportViewToken?: string,
) {
  validateDates(kind, query);
  let projection: Awaited<ReturnType<typeof buildProjection>> | undefined, rows: DerivedRow[] | undefined;
  let restatement: Restatement | undefined;
  return async (db: Database, batch?: { page: number; size: number }) => {
    projection ??= await buildProjection(db, projectionQuery(query), {
      captureEvents: true,
      snapshot: await reportSnapshot(db, query, exportViewToken),
    });
    if (query.basis === 'restated') restatement ??= await buildRestatement(db, projectionQuery(query), projection);
    rows ??= derivedRows(kind, query, [...projection.cells.values()], projection, restatement?.events);
    const result = await derivedResult(kind, query, sortRows(rows, query), projection, batch);
    const view = restatement?.view ?? postedView(projection);
    const viewToken = hash(JSON.stringify([result, view, restatement?.digest, projection.snapshot.database]));
    if (!batch) rememberReportSnapshot(viewToken, query, projection.snapshot);
    return { ...result, ...view, viewToken };
  };
}

async function derivedResult(
  kind: 'report-turnover' | 'report-aging',
  query: DerivedQuery,
  rows: DerivedRow[],
  projection: Awaited<ReturnType<typeof buildProjection>>,
  batch?: { page: number; size: number },
) {
  const page = batch?.page ?? query.page,
    pageSize = batch?.size ?? query.pageSize,
    pageData = pageResult(rows.slice((page - 1) * pageSize, page * pageSize), rows.length, {
      ...query,
      page,
      pageSize,
    }),
    totals =
      kind === 'report-turnover' ? turnoverTotals(rows as ReportTurnoverRow[]) : agingTotals(rows as ReportAgingRow[]),
    report = reportMeta(kind, query, rows, projection),
    response = { ...pageData, totals, report };
  return {
    ...response,
    viewToken: hash(JSON.stringify([reportQueryFingerprint(query, projection.snapshot), projection.digest, response])),
  };
}
