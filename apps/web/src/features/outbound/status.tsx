import { Tag } from 'antd';
import type { Order } from '@wms/contracts';
export const statusLabels: Record<string, string> = {
  open: '待扫码', frozen: '待出库确认', confirmed: '已出库', audited: '已审核', submit: '待提交',
};
const statusColors: Record<string, string> = { open: 'processing', frozen: 'warning', confirmed: 'success' };
export function Status({ status }: { status: Order['status'] }) {
  return (
    <Tag color={statusColors[status] ?? 'default'}>{statusLabels[status] ?? status}</Tag>
  );
}
