import { WEB_EXPORT_MAX_ROWS, type ExportRequest } from '@wms/contracts';
import type { Database } from '../../db/mysql.ts';
import { AppError } from '../../shared/errors.ts';
import { exportReader, type ExportPage } from './read.ts';

export async function assertExportLimit(db: Database, request: ExportRequest): Promise<void> {
  const count = await db.readSnapshot((tx) => countExportRows(tx, request));
  if (count <= WEB_EXPORT_MAX_ROWS) return;
  throw new AppError(
    'EXPORT_TOO_LARGE',
    `超过单文件 ${WEB_EXPORT_MAX_ROWS.toLocaleString('zh-CN')} 行（实际 ${count.toLocaleString('zh-CN')} 行），请缩小范围；不会截断导出`,
    422,
  );
}

async function countExportRows(db: Database, request: ExportRequest): Promise<number> {
  const read = exportReader(request.kind, request.query);
  const current = await read(db);
  assertCurrentView(current, request);
  if (request.schema === 'matched_lines' && request.scope === 'selected')
    return countSelectedLines(db, request, current);
  if (request.scope === 'all')
    return request.schema === 'matched_lines' ? (current.matchedTotals?.lineCount ?? 0) : current.total;
  if (request.scope === 'selected') return request.selected.length;
  return request.schema === 'matched_lines'
    ? current.items.reduce((sum, row) => sum + Number(row.matchedLineCount ?? 0), 0)
    : current.items.length;
}

function assertCurrentView(current: ExportPage, request: ExportRequest): void {
  if (current.viewToken !== request.viewToken)
    throw new AppError('EXPORT_VIEW_CHANGED', '列表已变化，请刷新核对后重新导出', 409);
}

async function countSelectedLines(db: Database, request: ExportRequest, current: ExportPage): Promise<number> {
  const selected = new Set(request.selected.map((row) => row.id));
  let matched = 0;
  for (let offset = 0; offset < current.total && selected.size; offset += 200) {
    const page = await exportReader(request.kind, request.query)(db, {
      page: offset / 200 + 1,
      size: 200,
      snapshot: current,
    });
    matched += selectedLineCount(page.items, selected);
  }
  return matched;
}

function selectedLineCount(items: Record<string, unknown>[], selected: Set<string>): number {
  let matched = 0;
  for (const row of items) {
    if (!selected.delete(String(row.id))) continue;
    matched += Number(row.matchedLineCount ?? 0);
  }
  return matched;
}
