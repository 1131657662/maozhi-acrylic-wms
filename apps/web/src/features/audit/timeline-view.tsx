import { useQuery } from '@tanstack/react-query';
import { Card, Pagination, Skeleton, Space, theme } from 'antd';
import { auditKeys } from './keys';
import { AuditEvents, AuditEventContinuation } from './events';
import { AuditEmpty } from './empty';
import { RequestError } from '../../components/RequestError';
export function AuditTimelineView({
  params,
  onPage,
}: {
  params: Record<string, string>;
  onPage: (page: number) => void;
}) {
  const query = useQuery(auditKeys.timeline(params));
  const { token } = theme.useToken();
  if (query.error) return <RequestError error={query.error} retry={() => void query.refetch()} />;
  if (!query.data) return <Skeleton active />;
  return (
    <Space
      orientation="vertical"
      data-testid="audit-timeline"
      size="middle"
      style={{ width: '100%', marginTop: token.margin }}
    >
      {!query.data.items.length && <AuditEmpty />}
      {query.data.items.map((group) => (
        <Card key={group.id} title={`${group.objectLabel} · ${group.objectType}`}>
          <AuditEvents items={group.events.items} />
          {group.events.nextCursor && <AuditEventContinuation id={group.id} cursor={group.events.nextCursor} />}
        </Card>
      ))}
      <Pagination
        current={query.data.page}
        total={query.data.total}
        pageSize={query.data.pageSize}
        showSizeChanger={false}
        onChange={onPage}
      />
    </Space>
  );
}
