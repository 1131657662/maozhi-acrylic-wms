import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Button, Card, Empty, Spin, Timeline } from 'antd';
import { Link } from '@umijs/max';
import { listTime, type AuditRow } from '@wms/contracts';
import { RequestError } from '../../components/RequestError';
import { auditKeys } from './keys';
import { auditCopy as t } from './text';
import { AuditActionLabel, AuditResultLabel } from './labels';
export function AuditEvents({ items }: { items: AuditRow[] }) {
  if (!items.length) return <Empty description={t.empty} />;
  return (
    <Timeline
      titleSpan={6}
      items={items.map((row) => ({
        key: row.id,
        title: listTime(row.createdAt),
        content: (
          <>
            <AuditActionLabel row={row} /> <AuditResultLabel result={row.result} />
            <div>
              {row.actor} · {row.channel} · {row.effect}
            </div>
            <div>{row.summary}</div>
            {row.href && <Link to={row.href}>{row.objectLabel}</Link>}
          </>
        ),
      }))}
    />
  );
}
export function AuditEventContinuation({
  id,
  cursor: start,
  related = false,
}: {
  id: string;
  cursor: string;
  related?: boolean;
}) {
  const [cursor, setCursor] = useState(start),
    [opened, setOpened] = useState(false);
  const query = useQuery({ ...auditKeys.events(id, cursor, related), enabled: opened });
  return (
    <>
      {!opened && <Button onClick={() => setOpened(true)}>{t.more}</Button>}
      {opened &&
        (query.error ? (
          <RequestError error={query.error} />
        ) : !query.data ? (
          <Spin />
        ) : (
          <>
            <AuditEvents items={query.data.items} />
            {query.data.nextCursor && <Button onClick={() => setCursor(query.data!.nextCursor!)}>{t.next}</Button>}
          </>
        ))}
    </>
  );
}
export function ObjectAuditTimeline({ kind, id }: { kind: string; id: string }) {
  const [cursor, setCursor] = useState('');
  const query = useQuery(auditKeys.object(kind, id, cursor));
  return (
    <Card
      title={t.title}
      data-testid="object-audit-timeline"
      extra={<Button onClick={() => void query.refetch()}>{t.refresh}</Button>}
    >
      {query.error ? (
        <RequestError error={query.error} />
      ) : !query.data ? (
        <Spin />
      ) : (
        <>
          <AuditEvents items={query.data.items} />
          {query.data.nextCursor && <Button onClick={() => setCursor(query.data!.nextCursor!)}>{t.next}</Button>}
        </>
      )}
    </Card>
  );
}
