import type { ReportKind, ReportQuery, ReportMonthlyRow, ReportDetailRow } from '@wms/contracts';
import type { Database } from '../../db/mysql.ts';
import { AppError } from '../../shared/errors.ts';
import { hash } from '../../shared/hash.ts';
import { pageResult } from '../web-lists/query.ts';
import { reportSnapshot, rememberReportSnapshot, reportQueryFingerprint } from './snapshot.ts';
import { interactionModel } from './interaction-model.ts';

function validateQuery(query: ReportQuery): void {
  const today = new Date(Date.now() + 8 * 3600000).toISOString().slice(0, 10);
  if (query.toDay > today)
    throw new AppError('REPORT_FUTURE', '不能将未来日期视为已入账区间，请选择今天或更早的截止日', 422);
}
export function reportReader(kind: ReportKind, query: ReportQuery, exportViewToken?: string) {
  validateQuery(query);
  let model: Awaited<ReturnType<typeof interactionModel>> | undefined;
  let snapshot: Awaited<ReturnType<typeof reportSnapshot>> | undefined;
  return async (db: Database, batch?: { page: number; size: number }) => {
    snapshot ??= await reportSnapshot(db, query, exportViewToken);
    model ??= await interactionModel(db, { kind, query, snapshot });
    const paging = { ...query, page: batch?.page ?? query.page, pageSize: batch?.size ?? query.pageSize };
    const { rows, view, ...metadata } = model;
    const result = {
      ...pageResult<ReportMonthlyRow | ReportDetailRow>(
        rows.slice((paging.page - 1) * paging.pageSize, paging.page * paging.pageSize),
        rows.length,
        paging,
      ),
      ...metadata,
      ...view,
    };
    const viewToken = hash(JSON.stringify([kind, reportQueryFingerprint(query, snapshot), snapshot.database, model]));
    if (!batch) rememberReportSnapshot(viewToken, query, snapshot, { kind, rows, report: model.report, view });
    return { ...result, viewToken };
  };
}
export async function readReport(db: Database, kind: ReportKind, query: ReportQuery) {
  return db.readSnapshot(reportReader(kind, query));
}
