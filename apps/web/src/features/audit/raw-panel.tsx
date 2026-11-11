import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Button, Space, Spin, Typography } from 'antd';
import { RequestError } from '../../components/RequestError';
import { auditKeys } from './keys';
import { auditCopy as t } from './text';
function readable(value: unknown): string {
  if (typeof value === 'string') {
    try {
      return JSON.stringify(JSON.parse(value), null, 2);
    } catch {
      return value;
    }
  }
  return JSON.stringify(value, null, 2);
}
export function AuditRawPanel({ id }: { id: string }) {
  const [params, setParams] = useState<Record<string, string>>({});
  const query = useQuery({ ...auditKeys.raw(id, params), gcTime: 0, staleTime: Infinity, refetchOnWindowFocus: false });
  if (query.error) return <RequestError error={query.error} retry={() => void query.refetch()} />;
  if (!query.data) return <Spin />;
  return (
    <div data-testid="audit-raw">
      <Typography.Paragraph copyable>{query.data.traceId}</Typography.Paragraph>
      <Typography.Paragraph copyable={{ text: JSON.stringify(query.data.items, null, 2) }}>
        {t.copyRaw}
      </Typography.Paragraph>
      <Space wrap>
        <Button onClick={() => setParams({ traceId: query.data!.traceId })}>{t.trace}</Button>
        <Button href={`/api/v1/web/lists/audit/${id}/trace.json`} download>
          {t.diagnostic}
        </Button>
        {query.data.nextCursor && (
          <Button onClick={() => setParams({ traceId: query.data!.traceId, cursor: query.data!.nextCursor! })}>
            {t.next}
          </Button>
        )}
      </Space>
      {query.data.items.map((item, index) => (
        <RawRecord key={index} item={item} />
      ))}
    </div>
  );
}
function RawRecord({ item }: { item: Record<string, unknown> }) {
  const record = item.record && typeof item.record === 'object' ? (item.record as Record<string, unknown>) : {};
  return (
    <>
      {'before_json' in record && (
        <>
          <h3>{t.before}</h3>
          <pre className="business-list-json">{readable(record.before_json)}</pre>
          <h3>{t.after}</h3>
          <pre className="business-list-json">{readable(record.after_json)}</pre>
        </>
      )}
      <pre className="business-list-json">
        {readable(
          Object.fromEntries(Object.entries(record).filter(([key]) => !['before_json', 'after_json'].includes(key))),
        )}
      </pre>
    </>
  );
}
