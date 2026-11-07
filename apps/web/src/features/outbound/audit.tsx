import { useQuery } from '@tanstack/react-query';
import { Alert } from 'antd';
import { ProTable } from '@ant-design/pro-components';
import { outboundKeys } from './keys';
import { formatTime } from '../../lib/format-time';
export function Audit() {
  const { data: entries, isLoading: isLoadingEntries, error: entriesError } = useQuery(outboundKeys.audit);
  return (
    <section>
      <div className="page-title">
        <div>
          <span className="eyebrow">ACTIVITY LOG</span>
          <h1>操作记录</h1>
          <p>最近 100 条；保留操作者、动作、时间和请求编号。</p>
        </div>
      </div>
      {entriesError && <Alert type="error" title={entriesError.message} />}
      <ProTable
        rowKey="id"
        dataSource={entries}
        loading={isLoadingEntries}
        search={false}
        options={false}
        columns={[
          { title: '动作', dataIndex: 'action' },
          { title: '对象', dataIndex: 'targetId' },
          { title: '操作者', dataIndex: 'actor' },
          { title: '时间', dataIndex: 'createdAt', render: (_, row) => formatTime(row.createdAt) },
          { title: '请求编号', dataIndex: 'traceId', ellipsis: true, copyable: true },
        ]}
      />
    </section>
  );
}
