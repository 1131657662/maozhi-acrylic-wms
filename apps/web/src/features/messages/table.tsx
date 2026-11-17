import { Table, Tag, theme } from 'antd';
import { Link } from '@umijs/max';
import type { MouseEvent } from 'react';
import { listTime, messageCopy as t, messageTypeText, MESSAGES, type SystemMessage } from '@wms/contracts';

interface Props {
  items: SystemMessage[];
  total: number;
  page: number;
  loading: boolean;
  busy: boolean;
  onPage: (page: number) => void;
  onOpen: (row: SystemMessage, event: MouseEvent<HTMLAnchorElement>) => void;
}
export function MessageTable(props: Props) {
  const { token } = theme.useToken();
  return (
    <Table<SystemMessage>
      rowKey="id"
      dataSource={props.items}
      loading={props.loading}
      pagination={{
        current: props.page,
        total: props.total,
        pageSize: MESSAGES.pageSize,
        showSizeChanger: false,
        onChange: props.onPage,
        showTotal: t.total,
      }}
      columns={[
        { title: t.time, key: 'time', render: (_, row) => listTime(row.createdAt) },
        { title: t.type, key: 'type', render: (_, row) => messageTypeText[row.type] },
        {
          title: t.content,
          key: 'content',
          render: (_, row) => (
            <div>
              <Link to={row.linkPath} aria-disabled={props.busy} onClick={(event) => props.onOpen(row, event)}>
                {row.title}
              </Link>
              <div style={{ color: token.colorTextSecondary, marginTop: token.marginXXS }}>{row.body}</div>
            </div>
          ),
        },
        {
          title: t.state,
          key: 'state',
          render: (_, row) => <Tag>{row.resolvedAt ? t.resolved : row.readAt ? t.read : t.unread}</Tag>,
        },
      ]}
    />
  );
}
