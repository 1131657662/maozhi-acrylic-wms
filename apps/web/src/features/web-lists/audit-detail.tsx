import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Button, Collapse, Drawer, Skeleton, Table } from 'antd';
import { listTime, type WebAuditDetail } from '@wms/contracts';
import { ProDescriptions } from '@ant-design/pro-components';
import { RequestError } from '../../components/RequestError';
import { webListKeys } from './keys';
import { AuditRawPanel } from '../audit/raw-panel';
import { AuditEvents, AuditEventContinuation } from '../audit/events';
import { auditCopy as t } from '../audit/text';
export function AuditDetail({ id, onClose }: { id: string; onClose: () => void }) {
  const query = useQuery(webListKeys.auditDetail(id));
  return (
    <Drawer open title={t.detail} size={720} onClose={onClose}>
      {query.error ? (
        <RequestError error={query.error} action={<Button onClick={() => void query.refetch()}>{t.retry}</Button>} />
      ) : !query.data ? (
        <Skeleton active />
      ) : (
        <AuditDetailBody entry={query.data} />
      )}
    </Drawer>
  );
}
function AuditDetailBody({ entry }: { entry: WebAuditDetail }) {
  const [expanded, setExpanded] = useState<string[]>([]);
  return (
    <>
      <ProDescriptions
        column={1}
        dataSource={entry}
        columns={[
          { title: t.action, dataIndex: 'action' },
          { title: t.object, dataIndex: 'objectLabel' },
          { title: t.actor, dataIndex: 'actor' },
          { title: t.time, render: () => listTime(entry.createdAt) },
          { title: t.channel, dataIndex: 'channel' },
          { title: t.result, dataIndex: 'result' },
        ]}
      />
      <Table
        rowKey="field"
        size="small"
        pagination={false}
        dataSource={entry.changes}
        locale={{ emptyText: t.changesEmpty }}
        columns={[
          { title: t.field, dataIndex: 'label' },
          { title: t.before, dataIndex: 'before' },
          { title: t.after, dataIndex: 'after' },
          { title: t.unit, dataIndex: 'unit' },
        ]}
      />
      <Collapse
        activeKey={expanded}
        onChange={(keys) => setExpanded(Array.isArray(keys) ? keys : [keys])}
        items={[
          {
            key: 'related',
            label: t.related,
            children: (
              <>
                <AuditEvents items={entry.related.items} />
                {entry.related.nextCursor && (
                  <AuditEventContinuation id={entry.id} cursor={entry.related.nextCursor} related />
                )}
              </>
            ),
          },
          { key: 'raw', label: t.raw, children: expanded.includes('raw') ? <AuditRawPanel id={entry.id} /> : null },
        ]}
      />
    </>
  );
}
