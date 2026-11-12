import type { ReportKind, ReportQuery } from '@wms/contracts';
import type { Database } from '../../db/mysql.ts';
import { AppError } from '../../shared/errors.ts';
import { hash } from '../../shared/hash.ts';
import { pageResult } from '../web-lists/query.ts';
import { buildProjection } from './projection.ts';
import type { Projection, ReportReadQuery } from './types.ts';
import { detailPage, naturalOrder } from './detail-page.ts';
import { reportSnapshot, rememberReportSnapshot, reportQueryFingerprint } from './snapshot.ts';
import { buildRestatement, postedView, restatedDetails, type Restatement } from './restated.ts';

function monthlyPage(projection: Pick<Projection, 'monthly'>, query: ReportReadQuery) {
  const key = query.sortBy === 'postedAt' ? 'period' : query.sortBy,
    sign = query.direction === 'asc' ? 1 : -1;
  const rows = [...projection.monthly].sort(
    (a, b) => sign * (a[key].localeCompare(b[key]) || a.id.localeCompare(b.id)),
  );
  return pageResult(rows.slice((query.page - 1) * query.pageSize, query.page * query.pageSize), rows.length, query);
}
function validateQuery(kind: ReportKind, query: ReportQuery): void {
  if (kind === 'report-monthly' && query.movement !== 'all')
    throw new AppError('REPORT_SCOPE', '月报必须包含全部收发方向；方向筛选仅用于明细', 422);
  const today = new Date(Date.now() + 8 * 3600000).toISOString().slice(0, 10);
  if (query.toDay > today)
    throw new AppError('REPORT_FUTURE', '不能将未来日期视为已入账区间，请选择今天或更早的截止日', 422);
}
export function reportReader(kind: ReportKind, query: ReportQuery, exportViewToken?: string) {
  validateQuery(kind, query);
  let projection: Projection | undefined, cursor: number | undefined, restatement: Restatement | undefined;
  return async (db: Database, batch?: { page: number; size: number }) => {
    projection ??= await buildProjection(db, query, { snapshot: await reportSnapshot(db, query, exportViewToken) });
    if (query.basis === 'restated') restatement ??= await buildRestatement(db, query, projection);
    if (batch?.page === 1) cursor = undefined;
    const paging = { ...query, page: batch?.page ?? query.page, pageSize: batch?.size ?? query.pageSize };
    const result =
      kind === 'report-monthly'
        ? monthlyPage(restatement ?? projection, paging)
        : restatement
          ? restatedDetails(restatement, paging, projection)
          : await detailPage(db, { projection, query: paging, cursor: batch ? cursor : undefined });
    if (batch && kind === 'report-details' && naturalOrder(projection, query)) cursor = Number(result.items.at(-1)?.id);
    const view = restatement?.view ?? postedView(projection);
    const viewToken = hash(
      JSON.stringify([
        kind,
        reportQueryFingerprint(query, projection.snapshot),
        projection.snapshot.database,
        projection.digest,
        restatement?.digest,
        result,
        projection.metadata,
        view,
      ]),
    );
    if (!batch) rememberReportSnapshot(viewToken, query, projection.snapshot);
    return { ...result, report: projection.metadata, ...view, viewToken };
  };
}
export async function readReport(db: Database, kind: ReportKind, query: ReportQuery) {
  return db.readSnapshot(reportReader(kind, query));
}
