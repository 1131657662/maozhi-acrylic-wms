import { AuditOutlined, InboxOutlined, ExportOutlined, DatabaseOutlined, WarningOutlined } from '@ant-design/icons';
import type { AuditRow } from '@wms/contracts';
import { Tag } from 'antd';
import { StatusTag, type StatusTagType } from '../../components/ui';

export function AuditActionLabel({ row, design = true }: { row: AuditRow; design?: boolean }) {
  const Icon = row.dangerous
    ? WarningOutlined
    : row.objectType === '入库单'
      ? InboxOutlined
      : row.objectType === '出库单'
        ? ExportOutlined
        : row.objectType === '条码目录'
          ? DatabaseOutlined
          : AuditOutlined;
  if (row.dangerous)
    return design ? (
      <StatusTag status={row.action} type="warning" />
    ) : (
      <Tag color="warning" icon={<Icon />}>
        {row.action}
      </Tag>
    );
  return (
    <span>
      <Icon /> {row.action}
    </span>
  );
}
export function AuditResultLabel({ result, design = true }: { result: string; design?: boolean }) {
  return design ? (
    <StatusTag status={result} type={auditResultType(result)} />
  ) : (
    <Tag color={auditResultType(result)}>{result}</Tag>
  );
}

const resultTypes: Record<string, StatusTagType> = {
  完成: 'success',
  失败: 'error',
  结果待核实: 'warning',
};

function auditResultType(result: string): StatusTagType {
  return resultTypes[result] ?? 'default';
}
