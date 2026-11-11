import { AuditOutlined, InboxOutlined, ExportOutlined, DatabaseOutlined, WarningOutlined } from '@ant-design/icons';
import { Tag } from 'antd';
import type { AuditRow } from '@wms/contracts';

export function AuditActionLabel({ row }: { row: AuditRow }) {
  const Icon = row.dangerous
    ? WarningOutlined
    : row.objectType === '入库单'
      ? InboxOutlined
      : row.objectType === '出库单'
        ? ExportOutlined
        : row.objectType === '条码目录'
          ? DatabaseOutlined
          : AuditOutlined;
  return row.dangerous ? (
    <Tag color="warning" icon={<Icon />}>
      {row.action}
    </Tag>
  ) : (
    <span>
      <Icon /> {row.action}
    </span>
  );
}
export function AuditResultLabel({ result }: { result: string }) {
  const color =
    result === '失败' ? 'error' : result === '结果待核实' ? 'warning' : result === '完成' ? 'success' : 'default';
  return <Tag color={color}>{result}</Tag>;
}
