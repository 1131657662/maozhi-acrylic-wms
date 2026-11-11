import { useQuery } from '@tanstack/react-query';
import { Card, Empty, Pagination, Spin, theme } from 'antd';
import { AuditOutlined } from '@ant-design/icons';
import { PageContainer } from '@ant-design/pro-components';
import { auditKeys } from './keys';
import { auditCopy as t } from './text';
import { AuditEvents, AuditEventContinuation } from './events';
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
  if (!query.data) return <Spin />;
  return (
    <PageContainer
      title={
        <h1 style={{ fontSize: token.fontSizeHeading4, margin: 0 }}>
          <AuditOutlined style={{ fontSize: token.fontSizeLG, marginInlineEnd: token.marginXS }} />
          {t.title}
        </h1>
      }
      content={t.description}
      token={{ paddingInlinePageContainerContent: token.paddingLG }}
    >
      <div data-testid="audit-timeline">
        {!query.data.items.length && <Empty description={t.empty} />}
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
      </div>
    </PageContainer>
  );
}
