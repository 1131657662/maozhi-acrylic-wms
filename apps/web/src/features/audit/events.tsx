import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Button, Card, Empty, Spin, Timeline } from 'antd';
import { Link } from '@umijs/max';
import { listTime, type AuditRow } from '@wms/contracts';
import { RequestError } from '../../components/RequestError';
import { auditKeys } from './keys';
import { auditCopy as t } from './text';
import { AuditActionLabel, AuditResultLabel } from './labels';
import { EmptyState } from '../../components/ui';
export function AuditEvents({ items, design = false }: { items: AuditRow[]; design?: boolean }) {
  if (!items.length) return design ? <EmptyState description={t.empty} /> : <Empty description={t.empty} />;
  return (
    <Timeline
      titleSpan={6}
      items={items.map((row) => ({
        key: row.id,
        title: listTime(row.createdAt),
        content: (
          <>
            <AuditActionLabel row={row} design={design} /> <AuditResultLabel result={row.result} design={design} />
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
  design = false,
}: {
  id: string;
  cursor: string;
  related?: boolean;
  design?: boolean;
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
            <AuditEvents items={query.data.items} design={design} />
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
