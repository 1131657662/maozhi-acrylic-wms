import { Radio } from 'antd';
import {
  listFields,
  matchedLineFields,
  WEB_EXPORT_MAX_ROWS,
  WEB_EXPORT_SELECTED_MAX,
  type ExportRequest,
} from '@wms/contracts';
import { businessCopy } from '../../business-copy';
import type { ExportContext } from './panel';

export function ExportScope({
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
            label: `选中记录 · ${context.selected.length} ${['inbound', 'outbound'].includes(context.kind) ? '单' : '条'}`,
            disabled: !context.selected.length,
          },
        ]}
      />
      <p data-testid="export-fields">
        {businessCopy.webExportsPanel1}
        {fields.map((field) => field.label).join('、')}
      </p>
      <p>
        跨页选中最多 {WEB_EXPORT_SELECTED_MAX.toLocaleString('zh-CN')} 条；更多记录请用全部筛选结果。单文件最多{' '}
        {WEB_EXPORT_MAX_ROWS.toLocaleString('zh-CN')} 行，超限会提示实际条数。
      </p>
    </>
  );
}
