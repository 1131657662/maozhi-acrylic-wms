import { useState } from 'react';
import { Alert, Button, Drawer, Radio, Space } from 'antd';
import {
  listFields,
  matchedLineFields,
  WEB_EXPORT_MAX_ROWS,
  WEB_EXPORT_SELECTED_MAX,
  type ExportRequest,
  type ExportKind,
} from '@wms/contracts';
import { useExportSession } from './use-export-session';
import { ExportJobView } from './job-view';

export interface ExportContext {
  kind: ExportKind;
  query: Record<string, string>;
  columns: string[];
  viewToken: string;
  selected: { id: string; token: string }[];
  total: number;
  pageCount: number;
  matchedLineTotal?: number;
  matchedLinePageCount?: number;
}
export function ExportPanel({ context, refreshing }: { context: ExportContext; refreshing: boolean }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button aria-label="导出" disabled={refreshing || !context.viewToken} onClick={() => setOpen(true)}>
        导出
      </Button>
      <Drawer
        title="导出当前列表"
        open={open}
        onClose={() => setOpen(false)}
        size={640}
        mask={false}
        focusable={{ trap: false }}
        styles={{ wrapper: { maxWidth: '100vw' } }}
      >
        <ExportControls context={context} />
      </Drawer>
    </>
  );
}
function ExportControls({ context }: { context: ExportContext }) {
  const [scope, setScope] = useState<ExportRequest['scope']>('all');
  const supportsMatchedLines =
    (context.kind === 'inbound' || context.kind === 'outbound') && Boolean(context.query.productCodes);
  const [schema, setSchema] = useState<NonNullable<ExportRequest['schema']>>('document_summary');
  const [format, setFormat] = useState<NonNullable<ExportRequest['format']>>('xlsx');
  const session = useExportSession();
  const { data: job } = session;
  const generate = () =>
    session.generate({
      kind: context.kind,
      query: context.query,
      columns:
        schema === 'matched_lines'
          ? matchedLineFields(context.kind as 'inbound' | 'outbound').map((field) => field.key)
          : context.columns,
      viewToken: context.viewToken,
      selected: scope === 'selected' ? context.selected : [],
      scope,
      schema,
      format,
    });
  return (
    <Space orientation="vertical" style={{ width: '100%' }}>
      <p>跟随当前筛选、排序及可见列。生成后可核对本次范围合计，再下载完整文件。</p>
      {context.kind.startsWith('report-') && (
        <p>
          附页“收发存对账”与屏幕的全部仓品日期区间一致，不受明细方向筛选影响；主表只合计所选方向及导出范围，期初、期末不跨月相加。
        </p>
      )}
      <ExportScope context={context} scope={scope} setScope={setScope} schema={schema} />
      {supportsMatchedLines && (
        <Radio.Group
          aria-label="导出数据结构"
          value={schema}
          onChange={(event) => setSchema(event.target.value)}
          options={[
            { value: 'document_summary', label: '单据汇总' },
            { value: 'matched_lines', label: `命中明细 · ${context.matchedLineTotal ?? 0} 行` },
          ]}
        />
      )}
      <Radio.Group
        aria-label="导出格式"
        value={format}
        onChange={(event) => setFormat(event.target.value)}
        options={[
          { value: 'xlsx', label: 'XLSX（验收目标）' },
          ...(!context.kind.startsWith('report-') ? [{ value: 'csv', label: 'CSV' }] : []),
        ]}
      />
      <Button
        type={job?.state === 'ready' ? 'default' : 'primary'}
        loading={session.starting}
        disabled={
          !context.total ||
          (scope === 'selected' && (!context.selected.length || context.selected.length > WEB_EXPORT_SELECTED_MAX))
        }
        onClick={() => void generate()}
      >
        生成 {format.toUpperCase()}
      </Button>
      <ExportErrors session={session} />
      {job && <ExportJobView job={job} />}
      <p>生成期间可关闭面板继续操作列表；重新打开可查看进度。一次只运行一个导出任务。</p>
    </Space>
  );
}
function ExportScope({
  context,
  scope,
  setScope,
  schema,
}: {
  context: ExportContext;
  scope: ExportRequest['scope'];
  setScope: (scope: ExportRequest['scope']) => void;
  schema: NonNullable<ExportRequest['schema']>;
}) {
  const matchedLines = schema === 'matched_lines';
  const fields =
    matchedLines && (context.kind === 'inbound' || context.kind === 'outbound')
      ? matchedLineFields(context.kind)
      : context.columns.map((key) => listFields[context.kind].find((field) => field.key === key)!).filter(Boolean);
  return (
    <>
      <Radio.Group
        aria-label="导出范围"
        value={scope}
        onChange={(e) => setScope(e.target.value)}
        options={[
          {
            value: 'all',
            label: `全部筛选结果 · ${matchedLines ? (context.matchedLineTotal ?? 0) : context.total} ${matchedLines ? '行' : '条'}`,
            disabled: !context.total,
          },
          {
            value: 'page',
            label: `当前页 · ${matchedLines ? (context.matchedLinePageCount ?? 0) : context.pageCount} ${matchedLines ? '行' : '条'}`,
            disabled: !context.pageCount,
          },
          {
            value: 'selected',
            label: `选中记录 · ${context.selected.length} 单`,
            disabled: !context.selected.length,
          },
        ]}
      />
      <p data-testid="export-fields">字段顺序：{fields.map((field) => field.label).join('、')}</p>
      <p>
        跨页选中最多 {WEB_EXPORT_SELECTED_MAX.toLocaleString('zh-CN')} 条；更多记录请用全部筛选结果。单文件最多{' '}
        {WEB_EXPORT_MAX_ROWS.toLocaleString('zh-CN')} 行，超限会提示实际条数。
      </p>
    </>
  );
}
function ExportErrors({ session }: { session: ReturnType<typeof useExportSession> }) {
  return (
    <>
      {session.startError && (
        <Alert
          type="error"
          title={session.startError.message}
          description="筛选和选择已保留。列表变化时请关闭面板，刷新核对后重试。"
        />
      )}
      {session.error && (
        <Alert
          type="error"
          title={session.error.message}
          action={<Button onClick={() => void session.refetch()}>重试查询进度</Button>}
        />
      )}
    </>
  );
}
