import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Alert, Button, Card, Result, Skeleton } from 'antd';
import type { LifecycleKind, LifecyclePreview } from '@wms/contracts';
import { ApiError } from '../../api/client';
import { lifecycleKeys } from './keys';
import { LifecycleDrawer } from './drawer';
import { formatTime } from '../../lib/format-time';

function ClosedRecord({ data }: { data: LifecyclePreview }) {
  const closure = data.closure!;
  return (
    <Alert
      type="info"
      showIcon
      title={closure.action === 'reverse' ? '已撤销确认 · 原单已终结' : '已作废 · 未入账'}
      description={
        <>
          <p>
            原因：{closure.reason}；操作人：{closure.actor}；时间：{formatTime(closure.createdAt)}
          </p>
          <p>原单与原号保留，不能重新确认或开放扫码。实物退货须另走独立流程。</p>
        </>
      }
    />
  );
}
export function LifecyclePanel({ kind, id }: { kind: LifecycleKind; id: string }) {
  const {
    data: preview,
    isPending: isLoading,
    error: previewError,
    refetch: reloadPreview,
  } = useQuery(lifecycleKeys.detail(kind, id));
  const [selection, setSelection] = useState<LifecyclePreview | null>(null);
  if (isLoading) return <Skeleton active />;
  if (previewError instanceof ApiError && previewError.status === 403)
    return <Result status="403" title="仅 Web 可处理单据终结" />;
  if (previewError || !preview)
    return (
      <Alert
        type="error"
        title={previewError?.message ?? '单据终结预览不可用'}
        action={<Button onClick={() => void reloadPreview()}>重试</Button>}
      />
    );
  if (preview.closure) return <ClosedRecord data={preview} />;
  return (
    <Card title="纠错与终结">
      {preview.blockers.length > 0 ? (
        <Alert
          showIcon
          type="info"
          title="本单暂不能撤销或作废"
          description={
            <ul>
              {preview.blockers.map((b, i) => (
                <li key={`${b.code}:${i}`}>{b.message}</li>
              ))}
            </ul>
          }
        />
      ) : (
        <>
          <p>
            {preview.action === 'reverse'
              ? '误确认可核对原流水并反向补偿，不代表实物退货。'
              : '尚未入账，可填写原因作废；单号永久保留。'}
          </p>
          <Button danger onClick={() => setSelection(preview)}>
            {preview.action === 'reverse' ? '核对撤销误确认' : '核对并作废'}
          </Button>
        </>
      )}
      {selection && <LifecycleDrawer initial={selection} onClose={() => setSelection(null)} />}
    </Card>
  );
}
