import { Tag } from 'antd';
import type { Order } from '@wms/contracts';
export const statusLabels = { open: '待扫码', frozen: '待出库确认', confirmed: '已出库' };
export function Status({ status }: { status: Order['status'] }) {
  return (
    <Tag color={{ open: 'processing', frozen: 'warning', confirmed: 'success' }[status]}>{statusLabels[status]}</Tag>
  );
}
