import { Alert, Tag } from 'antd';

import { knownStatus as knownState, statusText } from '@wms/contracts';

export function StatusTag({ status, kind = 'outbound' }: { status: string | null; kind?: 'inbound' | 'outbound' }) {
  const known = knownState(status, kind);
  return (
    <Tag color={known?.color ?? 'default'} data-testid="status-tag">
      {statusText(status, kind)}
    </Tag>
  );
}

export function StatusNotice({ status, kind }: { status: string | null; kind: 'inbound' | 'outbound' }) {
  if (knownState(status, kind)) return null;
  return (
    <Alert
      type="info"
      showIcon
      data-testid="unknown-status-notice"
      title="此单据的状态含义尚未确认"
      description={
        <>
          目前可以查看明细，不能据此判断是否已{kind === 'inbound' ? '入库' : '出库'}。
          请按单号核对原始单据；规则确认前不要重复建单或手工改库存。
          {kind === 'outbound' && '本页出库确认已禁用。'}
        </>
      }
    />
  );
}
