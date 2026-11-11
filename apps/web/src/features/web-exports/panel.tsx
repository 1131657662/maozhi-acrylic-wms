import { useSubmitLock } from '../../components/form-protection/use-submit-lock';
import { ExportScope } from './scope';
import { RequestError } from '../../components/RequestError';
import { useState } from 'react';
import { Button, Drawer, Radio, Space } from 'antd';
import { matchedLineFields, WEB_EXPORT_SELECTED_MAX, type ExportRequest, type ExportKind } from '@wms/contracts';
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
export function ExportPanel({
  context,
  refreshing,
  onOpen,
}: {
  context: ExportContext;
  refreshing: boolean;
  onOpen?: () => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button
        aria-label="导出"
        disabled={refreshing || !context.viewToken}
        onClick={() => {
          onOpen?.();
          setOpen(true);
        }}
      >
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
        <ExportControls context={context} refreshing={refreshing} />
      </Drawer>
    </>
  );
}
function ExportControls({ context, refreshing }: { context: ExportContext; refreshing: boolean }) {
  const [scope, setScope] = useState<ExportRequest['scope']>('all');
  const supportsMatchedLines =
    (context.kind === 'inbound' || context.kind === 'outbound') && Boolean(context.query.productCodes);
  const [schema, setSchema] = useState<NonNullable<ExportRequest['schema']>>('document_summary');
  const [format, setFormat] = useState<NonNullable<ExportRequest['format']>>('xlsx');
  const session = useExportSession();
  const lock = useSubmitLock();
  const { data: job } = session;
  const generate = () => {
    if (refreshing) return;
    return session.generate({
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
  };
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
        loading={session.starting || lock.busy}
        disabled={
          lock.busy ||
          refreshing ||
          !context.total ||
          (scope === 'selected' && (!context.selected.length || context.selected.length > WEB_EXPORT_SELECTED_MAX))
        }
        onClick={() => void lock.run(async () => generate())}
      >
        {lock.text(`生成 ${format.toUpperCase()}`)}
      </Button>
      <ExportErrors session={session} />
      {job && <ExportJobView job={job} />}
      <p>生成期间可关闭面板继续操作列表；重新打开可查看进度。一次只运行一个导出任务。</p>
    </Space>
  );
}
function ExportErrors({ session }: { session: ReturnType<typeof useExportSession> }) {
  return (
    <>
      {session.startError && (
        <RequestError
          type="error"
          error={session.startError}
          description="筛选和选择已保留。列表变化时请关闭面板，刷新核对后重试。"
        />
      )}
      {session.error && (
        <RequestError
          type="error"
          error={session.error}
          action={<Button onClick={() => void session.refetch()}>重试查询进度</Button>}
        />
      )}
    </>
  );
}
