import { Alert, Tag } from 'antd';

const states = new Map([
  ['open', { text: '待扫码', color: 'processing' }],
  ['frozen', { text: '待出库确认', color: 'warning' }],
  ['confirmed', { text: '已出库', color: 'success' }],
  ['audited', { text: '已审核', color: 'default' }],
]);

function knownState(status: string | null, kind: 'inbound' | 'outbound') {
  if (kind === 'inbound' && status === 'pending') return { text: '待入库确认', color: 'warning' };
  return status === null ? undefined : states.get(status);
}

export function StatusTag({ status, kind = 'outbound' }: { status: string | null; kind?: 'inbound' | 'outbound' }) {
  const known = knownState(status, kind);
  const text = kind === 'inbound' && status === 'confirmed' ? '已入库' : (known?.text ?? status ?? '未记录');
  return (
    <Tag color={known?.color ?? 'default'} data-testid="status-tag">
      {known ? text : `状态待识别：${text === '' ? '空值' : text}`}
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
          原始状态：<strong>{status === '' ? '空值' : (status ?? '未记录')}</strong>。
          目前可以查看明细，不能据此判断是否已{kind === 'inbound' ? '入库' : '出库'}。
          请按单号核对原始单据；规则确认前不要重复建单或手工改库存。
          {kind === 'outbound' && '本页出库确认已禁用。'}
        </>
      }
    />
  );
}
