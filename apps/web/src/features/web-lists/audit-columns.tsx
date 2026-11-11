import type { ProColumns } from '@ant-design/pro-components';
import { type WebAuditRow, listTime } from '@wms/contracts';
import { Button } from 'antd';
import { auditCopy as t } from '../audit/text';

export function auditColumns(onOpen: (id: string) => void): ProColumns<WebAuditRow>[] {
  return [
    {
      title: t.action,
      dataIndex: 'action',
      width: 180,
      fixed: 'left',
      sorter: true,
      hideInSetting: true,
    },
    {
      title: t.object,
      dataIndex: 'objectLabel',
      width: 220,
      ellipsis: true,
      sorter: true,
    },
    { title: t.summary, dataIndex: 'summary', width: 260, ellipsis: true },
    { title: t.channel, dataIndex: 'channel', width: 120 },
    { title: t.result, dataIndex: 'result', width: 120 },
    { title: t.actor, dataIndex: 'actor', width: 120, sorter: true },
    { title: t.time, dataIndex: 'createdAt', width: 180, sorter: true, render: (_, row) => listTime(row.createdAt) },
    {
      title: '操作',
      key: 'actionDetail',
      valueType: 'option',
      width: 100,
      fixed: 'right',
      hideInSetting: true,
      render: (_, row) => (
        <Button type="link" onClick={() => onOpen(row.id)}>
          {t.view}
        </Button>
      ),
    },
  ];
}
