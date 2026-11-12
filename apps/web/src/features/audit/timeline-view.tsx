import { useQuery } from '@tanstack/react-query';
import { Pagination, Skeleton, Space } from 'antd';
import { auditKeys } from './keys';
import { AuditEvents, AuditEventContinuation } from './events';
import { AuditEmpty } from './empty';
import { RequestError } from '../../components/RequestError';
import { Card, SectionTitle } from '../../components/ui';
import { spacing } from '../../theme/design-tokens';
export function AuditTimelineView({
  params,
  onPage,
}: {
  params: Record<string, string>;
  onPage: (page: number) => void;
}) {
  const query = useQuery(auditKeys.timeline(params));
  if (query.error) return <RequestError error={query.error} retry={() => void query.refetch()} />;
  if (!query.data) return <Skeleton active />;
  return (
    <Space orientation="vertical" data-testid="audit-timeline" size={spacing[16]} style={{ width: '100%' }}>
      {!query.data.items.length && <AuditEmpty />}
      {query.data.items.map((group) => (
        <Card key={group.id} title={<SectionTitle title={`${group.objectLabel} · ${group.objectType}`} />}>
          <AuditEvents items={group.events.items} design />
          {group.events.nextCursor && <AuditEventContinuation id={group.id} cursor={group.events.nextCursor} design />}
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
