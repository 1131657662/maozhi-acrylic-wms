import {
  listFields,
  matchedLineFields,
  WEB_EXPORT_MAX_ROWS,
  type ExportJob,
  type ExportRequest,
  type ListField,
} from '@wms/contracts';
import type { Database } from '../../db/mysql.ts';
import { AppError } from '../../shared/errors.ts';
import { rowToken } from '../web-lists/query.ts';
import { exportReader, type ExportPage } from './read.ts';
import type { ExportWriter } from './writer.ts';

export interface ExportHooks {
  afterBatch?: (processed: number) => Promise<void>;
  beforePublish?: () => Promise<void>;
}
export interface Generation {
  request: ExportRequest;
  job: ExportJob;
  writer: ExportWriter;
  cancelled: () => boolean;
  hooks: ExportHooks;
}
export function requestedFields(request: ExportRequest): ListField[] {
  const schema = request.schema ?? 'document_summary';
  const allowed =
    schema === 'matched_lines' && (request.kind === 'inbound' || request.kind === 'outbound')
      ? matchedLineFields(request.kind)
      : listFields[request.kind];
  if (schema === 'matched_lines' && (!request.query.productCodes || !['inbound', 'outbound'].includes(request.kind)))
    throw new AppError('EXPORT_SCHEMA', '命中行导出仅适用于入库/出库商品反查', 422);
  if (schema === 'matched_lines') {
    const expected = allowed.map((field) => field.key);
    if (JSON.stringify(request.columns) !== JSON.stringify(expected))
      throw new AppError('EXPORT_COLUMNS', '命中行导出字段固定，请刷新后重试', 422);
  }
  const fields = request.columns.map((key) => allowed.find((f) => f.key === key));
  if (fields.some((f) => !f) || new Set(request.columns).size !== fields.length || fields[0]?.key !== allowed[0]?.key)
    throw new AppError('EXPORT_COLUMNS', '导出列不合法，请刷新列设置', 422);
  return fields.filter((f): f is ListField => !!f);
}
function check(g: Generation): void {
  if (g.cancelled()) throw new AppError('EXPORT_CANCELLED', '导出已取消，未提供部分文件', 409);
  if (Date.now() - Date.parse(g.job.createdAt) > 300_000)
    throw new AppError('EXPORT_TIMEOUT', '生成超时，请缩小筛选范围后重试，未提供截断文件', 409);
}
function appendPage(g: Generation, page: ExportPage, selected: Map<string, string>): void {
  const schema = g.request.schema ?? 'document_summary';
  for (const row of page.items) {
    if (g.request.scope === 'selected' && !selected.has(String(row.id))) continue;
    if (g.request.scope === 'selected' && rowToken(row) !== selected.get(String(row.id)))
      throw new AppError('EXPORT_VIEW_CHANGED', '选中记录已变化，请刷新列表并重新核对选择', 409);
    const rows =
      schema === 'matched_lines'
        ? ((row.matchedLines as Record<string, unknown>[] | undefined) ?? []).map((line) => ({
            ...line,
            [g.request.kind === 'inbound' ? 'receiptNo' : 'orderNo']:
              row[g.request.kind === 'inbound' ? 'receiptNo' : 'orderNo'],
          }))
        : [row];
    for (const exportRow of rows) {
      const cells = g.writer.append(exportRow);
      if (g.job.preview.length < 20) g.job.preview.push(cells);
      g.job.processed++;
    }
    if (g.request.scope === 'selected') selected.delete(String(row.id));
  }
  g.job.totals = g.writer.totals();
}
export async function generateSnapshot(db: Database, g: Generation): Promise<void> {
  const schema = g.request.schema ?? 'document_summary';
  const read = exportReader(g.request.kind, g.request.query);
  const selected = new Map(g.request.selected.map((r) => [r.id, r.token]));
  await db.readSnapshot(async (tx) => {
    const current = await read(tx);
    if (current.viewToken !== g.request.viewToken)
      throw new AppError('EXPORT_VIEW_CHANGED', '列表已变化，请刷新核对后重新导出', 409);
    const matchedPageTotal =
      schema === 'matched_lines'
        ? current.items.reduce((sum, row) => sum + Number(row.matchedLineCount ?? 0), 0)
        : current.items.length;
    g.job.total =
      g.request.scope === 'all'
        ? schema === 'matched_lines'
          ? Number(current.matchedTotals?.lineCount ?? 0)
          : current.total
        : g.request.scope === 'page'
          ? matchedPageTotal
          : schema === 'matched_lines'
            ? 0
            : selected.size;
    if (!g.job.total && !(g.request.scope === 'selected' && schema === 'matched_lines'))
      throw new AppError('EXPORT_EMPTY', '此范围没有可导出记录', 422);
    if (g.job.total > WEB_EXPORT_MAX_ROWS)
      throw new AppError(
        'EXPORT_TOO_LARGE',
        `超过单文件 ${WEB_EXPORT_MAX_ROWS.toLocaleString('zh-CN')} 行（实际 ${g.job.total.toLocaleString('zh-CN')} 行），请缩小范围；不会截断导出`,
        422,
      );
    if (g.request.scope === 'page') {
      appendPage(g, current, selected);
      await g.hooks.afterBatch?.(g.job.processed);
    } else await appendBatches(tx, g, { read, selected, current });
    check(g);
    if (g.request.scope === 'selected' && selected.size)
      throw new AppError('EXPORT_VIEW_CHANGED', '部分选中记录已不在当前筛选结果中，请刷新核对后重试', 409);
    if (g.job.processed > WEB_EXPORT_MAX_ROWS)
      throw new AppError(
        'EXPORT_TOO_LARGE',
        `超过单文件 ${WEB_EXPORT_MAX_ROWS.toLocaleString('zh-CN')} 行（实际至少 ${g.job.processed.toLocaleString('zh-CN')} 行），请缩小范围；不会截断导出`,
        422,
      );
    if (schema === 'matched_lines') g.job.total = g.job.processed;
    if (!g.job.total) throw new AppError('EXPORT_EMPTY', '此范围没有可导出记录', 422);
    if (g.job.processed !== g.job.total)
      throw new AppError('EXPORT_VIEW_CHANGED', '选中记录已不在筛选结果中，请刷新核对', 409);
    await g.writer.finish(g.job.processed, current.report);
  });
}
async function appendBatches(
  db: Database,
  g: Generation,
  context: { read: ReturnType<typeof exportReader>; selected: Map<string, string>; current: ExportPage },
): Promise<void> {
  for (let offset = 0; offset < context.current.total; offset += 1000) {
    check(g);
    const page = await context.read(db, { page: offset / 1000 + 1, size: 1000, snapshot: context.current });
    appendPage(g, page, context.selected);
    await g.writer.drain();
    await g.hooks.afterBatch?.(g.job.processed);
  }
}
