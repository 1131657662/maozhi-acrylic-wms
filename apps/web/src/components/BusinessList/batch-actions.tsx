import { useRef, useState } from 'react';
import { Alert, Button, Input, Modal, Space, Spin, Tooltip, Typography, theme } from 'antd';
import { batchText, type ExcludedBatchRow } from './batch-text';
import type { LifecycleKind, BatchReverseResponse } from '@wms/contracts';
import {
  BATCH_CONFIRM_DISPLAY_LIMIT,
  lifecyclePreviewSchema,
  type BatchReverseCommand,
  type LifecyclePreview,
} from '@wms/contracts';
import { request } from '../../api/client';
import { useBatchReverse } from '../../features/document-lifecycle/use-batch-reverse';

export interface BatchRow {
  id: string;
  number: string;
}
interface Props {
  kind: LifecycleKind;
  rows: BatchRow[];
  excluded: ExcludedBatchRow[];
  selectedCount: number;
  onClear: () => void;
}
function resultText(result: BatchReverseResponse['results'][number]) {
  return result.success ? `${result.number}：已撤销` : `${result.number}：${result.message ?? '撤销失败'}`;
}
function selectedNumbers(rows: BatchRow[]) {
  const shown = rows.slice(0, BATCH_CONFIRM_DISPLAY_LIMIT).map((row) => row.number);
  const suffix = rows.length > BATCH_CONFIRM_DISPLAY_LIMIT ? `，共 ${rows.length} 条` : '';
  return `${shown.join('、')}${suffix}`;
}
export function BatchReverseActions({ kind, rows, excluded, selectedCount, onClear }: Props) {
  const { token } = theme.useToken();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState('批量撤销误确认');
  const [previews, setPreviews] = useState<Record<string, LifecyclePreview>>({});
  const [prepareError, setPrepareError] = useState('');
  const [result, setResult] = useState<BatchReverseResponse | null>(null);
  const pendingCommand = useRef<BatchReverseCommand | null>(null);
  const mutation = useBatchReverse();
  const preparing = open && Object.keys(previews).length !== rows.length && !prepareError && !result;
  const visible = selectedCount > 0;
  async function openModal() {
    setOpen(true);
    setResult(null);
    setPrepareError('');
    setPreviews({});
    pendingCommand.current = null;
    try {
      const values = await Promise.all(
        rows.map(
          async (row) => [row.id, await request(`/${kind}/${row.id}/lifecycle`, lifecyclePreviewSchema)] as const,
        ),
      );
      setPreviews(Object.fromEntries(values));
    } catch (error) {
      setPrepareError(error instanceof Error ? error.message : '预览加载失败，请重试');
    }
  }
  async function submit() {
    if (Object.keys(previews).length !== rows.length) return;
    pendingCommand.current ??= {
      kind,
      reason,
      items: rows.map((row) => ({
        id: row.id,
        expectedToken: previews[row.id]!.token,
        key: crypto.randomUUID(),
      })),
    };
    const response = await mutation.mutateAsync(pendingCommand.current);
    setResult(response);
  }
  return (
    <div
      className="business-list-batch-slot"
      style={{ borderColor: token.colorBorderSecondary, background: token.colorFillQuaternary }}
      data-testid={`${kind}-batch-actions`}
    >
      {visible ? (
        <Space size="small">
          <Tooltip title={excluded.map((row) => `${row.number}：${row.reason}`).join('；')}>
            <span role="status">
              {batchText.counts(rows.length, excluded.length)}
              {excluded.length > 0 && excluded.every((row) => row.reason === batchText.history)
                ? `（${batchText.history}）`
                : ''}
            </span>
          </Tooltip>
          <Button type="link" onClick={onClear}>
            清空选择
          </Button>
          <Tooltip title={!rows.length ? batchText.none : undefined}>
            <span>
              <Button danger disabled={!rows.length} onClick={() => void openModal()}>
                批量撤销
              </Button>
            </span>
          </Tooltip>
        </Space>
      ) : (
        <span aria-hidden="true">&nbsp;</span>
      )}
      <Modal
        title="确认批量撤销"
        open={open}
        onCancel={() => (mutation.isPending ? undefined : setOpen(false))}
        afterOpenChange={(nextOpen) => {
          if (!nextOpen && result) {
            onClear();
            setResult(null);
          }
        }}
        onOk={() => void submit()}
        okText="确认批量撤销"
        cancelText="取消"
        okButtonProps={{ danger: true, disabled: preparing || Boolean(prepareError) || Boolean(result) }}
        confirmLoading={mutation.isPending}
        destroyOnHidden
      >
        {preparing && <Spin description="正在核对单据状态" />}
        <Typography.Paragraph>受影响单据：{selectedNumbers(rows)}</Typography.Paragraph>
        {excluded.length > 0 && (
          <Alert
            type="info"
            title={`${batchText.excluded}（${excluded.length} 张）`}
            description={
              <div data-testid="batch-excluded">
                {excluded.map((row) => (
                  <div key={row.id}>
                    {row.number}：{row.reason}
                  </div>
                ))}
              </div>
            }
          />
        )}
        {prepareError && <Alert type="error" showIcon title={prepareError} />}
        {mutation.error && <Alert type="error" showIcon title={mutation.error.message} />}
        {result && (
          <Alert
            type={result.failed ? 'warning' : 'success'}
            showIcon
            title={`完成：成功 ${result.succeeded} 条，失败 ${result.failed} 条`}
            description={
              <Space orientation="vertical" size={0} data-testid={`${kind}-batch-results`}>
                {result.results.map((item) => (
                  <span key={item.id}>{resultText(item)}</span>
                ))}
              </Space>
            }
          />
        )}
        {!result && (
          <Input.TextArea
            aria-label="批量撤销原因"
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            disabled={Boolean(pendingCommand.current) || mutation.isPending}
            maxLength={500}
            showCount
            autoSize={{ minRows: 3, maxRows: 5 }}
          />
        )}
      </Modal>
    </div>
  );
}
