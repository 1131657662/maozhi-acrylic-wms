import { useQuery } from '@tanstack/react-query';
import { Alert, Button, Drawer, Skeleton } from 'antd';
import { ProDescriptions } from '@ant-design/pro-components';
import { webListKeys } from './keys';
import { formatTime } from '../../lib/format-time';

function readable(value: string): string {
  try {
    return JSON.stringify(JSON.parse(value), null, 2);
  } catch {
    return value;
  }
}
export function AuditDetail({ id, onClose }: { id: number; onClose: () => void }) {
  const { data: entry, error, isPending, refetch } = useQuery(webListKeys.auditDetail(id));
  return (
    <Drawer open title="操作日志详情" size={640} onClose={onClose}>
      {error ? (
        <Alert type="error" title={error.message} action={<Button onClick={() => void refetch()}>重试</Button>} />
      ) : isPending || !entry ? (
        <Skeleton active />
      ) : (
        <>
          <ProDescriptions
            column={1}
            dataSource={entry}
            columns={[
              { title: '动作', dataIndex: 'action' },
              { title: '对象', dataIndex: 'targetId' },
              { title: '操作者', dataIndex: 'actor' },
              { title: '时间', render: () => formatTime(entry.createdAt) },
              { title: '请求编号', dataIndex: 'traceId', copyable: true },
            ]}
          />
          <h3>操作前</h3>
          <pre className="business-list-json">{readable(entry.beforeJson)}</pre>
          <h3>操作后</h3>
          <pre className="business-list-json">{readable(entry.afterJson)}</pre>
        </>
      )}
    </Drawer>
  );
}
