import { Tag } from 'antd';

const states = new Map([
  ['open', { text: '待扫码', color: 'processing' }],
  ['frozen', { text: '待出库确认', color: 'warning' }],
  ['confirmed', { text: '已出库', color: 'success' }],
  ['audited', { text: '已审核', color: 'default' }],
]);

export function StatusTag({ status, kind = 'outbound' }: { status: string | null; kind?: 'inbound' | 'outbound' }) {
  const known = status === null ? undefined : states.get(status);
  const text = kind === 'inbound' && status === 'confirmed' ? '已入库' : (known?.text ?? status ?? '未记录');
  return (
    <Tag color={known?.color ?? 'default'} data-testid="status-tag">
      {text === '' ? '空值' : text}
    </Tag>
  );
}
