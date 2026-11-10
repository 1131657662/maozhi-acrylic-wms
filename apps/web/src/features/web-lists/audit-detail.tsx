import { RequestError } from '../../components/RequestError';
import { useQuery } from '@tanstack/react-query';
import { Button, Collapse, Drawer, Skeleton, Typography } from 'antd';
import { auditActionText, businessLabels } from '@wms/contracts';
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
        <RequestError type="error" error={error} action={<Button onClick={() => void refetch()}>重试</Button>} />
      ) : isPending || !entry ? (
        <Skeleton active />
      ) : (
        <>
          <ProDescriptions
            column={1}
            dataSource={entry}
            columns={[
              { title: '动作', render: () => auditActionText(entry.action) },
              { title: '对象', render: () => businessLabels.relatedRecord },
              { title: '操作者', dataIndex: 'actor' },
              { title: '时间', render: () => formatTime(entry.createdAt) },
            ]}
          />
          <Collapse
            items={[
              {
                key: 'raw',
                label: '原始数据',
                children: (
                  <>
                    <Typography.Paragraph copyable>{entry.traceId}</Typography.Paragraph>
                    <h3>操作前</h3>
                    <pre className="business-list-json">{readable(entry.beforeJson)}</pre>
                    <h3>操作后</h3>
                    <pre className="business-list-json">{readable(entry.afterJson)}</pre>
                  </>
                ),
              },
            ]}
          />
        </>
      )}
    </Drawer>
  );
}
