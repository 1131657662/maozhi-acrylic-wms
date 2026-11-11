import type { ProColumns } from '@ant-design/pro-components';
import { auditActionText, businessLabels, type WebAuditRow } from '@wms/contracts';
import { Button } from 'antd';
import { formatTime } from '../../lib/format-time';

export function auditColumns(onOpen: (id: number) => void): ProColumns<WebAuditRow>[] {
  return [
    {
      title: '动作',
      dataIndex: 'action',
      width: 180,
      fixed: 'left',
      sorter: true,
      hideInSetting: true,
      render: (_, row) => auditActionText(row.action),
    },
    {
      title: '对象',
      dataIndex: 'targetId',
      width: 220,
      ellipsis: true,
      sorter: true,
      render: () => businessLabels.relatedRecord,
    },
    { title: '操作者', dataIndex: 'actor', width: 120, sorter: true },
    { title: '时间', dataIndex: 'createdAt', width: 180, sorter: true, render: (_, row) => formatTime(row.createdAt) },
    {
      title: '操作',
      key: 'actionDetail',
      valueType: 'option',
      width: 100,
      fixed: 'right',
      hideInSetting: true,
      render: (_, row) => (
        <Button type="link" onClick={() => onOpen(row.id)}>
          查看详情
        </Button>
      ),
    },
  ];
}
