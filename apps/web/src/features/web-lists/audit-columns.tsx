import type { ProColumns } from '@ant-design/pro-components';
import { type WebAuditRow, listTime } from '@wms/contracts';
import { Button } from 'antd';
import { Link } from '@umijs/max';
import { auditCopy as t } from '../audit/text';
import { AuditActionLabel, AuditResultLabel } from '../audit/labels';

export function auditColumns(onOpen: (id: string) => void): ProColumns<WebAuditRow>[] {
  return [
    {
      title: t.time,
      dataIndex: 'createdAt',
      width: 180,
      fixed: 'left',
      hideInSetting: true,
      sorter: true,
      render: (_, row) => listTime(row.createdAt),
    },
    { title: t.action, dataIndex: 'action', width: 180, render: (_, row) => <AuditActionLabel row={row} /> },
    {
      title: t.object,
      dataIndex: 'objectLabel',
      width: 220,
      ellipsis: true,
      sorter: true,
      render: (_, row) => (row.href ? <Link to={row.href}>{row.objectLabel}</Link> : row.objectLabel),
    },
    { title: t.summary, dataIndex: 'summary', width: 260, ellipsis: true },
    { title: t.channel, dataIndex: 'channel', width: 120 },
    { title: t.result, dataIndex: 'result', width: 140, render: (_, row) => <AuditResultLabel result={row.result} /> },
    { title: t.actor, dataIndex: 'actor', width: 120, sorter: true, hideInTable: true },
    {
      title: t.operations,
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
