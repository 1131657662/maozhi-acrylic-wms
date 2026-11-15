import { reportQuerySchema, reportTurnoverQuerySchema, reportAgingQuerySchema, type ReportKind } from '@wms/contracts';
import type { Database } from '../../db/mysql.ts';
import { replayReportModel } from '../reports/snapshot.ts';
import { pageResult } from '../web-lists/query.ts';
import type { ReportExportModel } from '../reports/export-model.ts';

export function reportExportReplay(kind: ReportKind, input: Record<string, string>, token: string) {
  const query = (
    kind === 'report-aging'
      ? reportAgingQuerySchema
      : kind === 'report-turnover'
        ? reportTurnoverQuerySchema
        : reportQuerySchema
  ).parse(input);
  let model: ReportExportModel | undefined;
  return async (db: Database, batch?: { page: number; size: number }) => {
    model ??= await replayReportModel(db, { kind, query, token });
    const paging = { ...query, page: batch?.page ?? query.page, pageSize: batch?.size ?? query.pageSize };
    const rows = model.rows.slice((paging.page - 1) * paging.pageSize, paging.page * paging.pageSize);
    return { ...pageResult(rows, model.rows.length, paging), report: model.report, ...model.view, viewToken: token };
  };
}
