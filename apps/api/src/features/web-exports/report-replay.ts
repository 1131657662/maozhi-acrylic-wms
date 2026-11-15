import { reportQuerySchema, reportTurnoverQuerySchema, reportAgingQuerySchema, type ReportKind } from '@wms/contracts';
import type { Database } from '../../db/mysql.ts';
import { replayReportModel } from '../reports/snapshot.ts';
import { pageResult } from '../web-lists/query.ts';
import type { ReportExportModel } from '../reports/export-model.ts';
import type { ExportBatch } from './read.ts';

export function reportExportReplay(kind: ReportKind, input: Record<string, string>, token: string) {
  const query = (
    kind === 'report-aging'
      ? reportAgingQuerySchema
      : kind === 'report-turnover'
        ? reportTurnoverQuerySchema
        : reportQuerySchema
  ).parse(input);
  let model: ReportExportModel | undefined;
  return async (db: Database, batch?: ExportBatch) => {
    model ??= await replayReportModel(db, { kind, query, token });
    const paging = { ...query, page: batch ? 1 : query.page, pageSize: batch?.size ?? query.pageSize };
    const start = batch ? (batch.after?.position ?? 0) : (query.page - 1) * query.pageSize;
    const rows = model.rows.slice(start, start + paging.pageSize);
    const nextCursor = rows.length ? { keys: [], position: start + rows.length } : undefined;
    return {
      ...pageResult(rows, model.rows.length, paging),
      report: model.report,
      ...model.view,
      viewToken: token,
      nextCursor,
    };
  };
}
