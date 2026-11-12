import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Alert, Button, Collapse, Drawer, Skeleton, Table } from 'antd';
import { AuditResultLabel } from '../audit/labels';
import { listTime, type WebAuditDetail } from '@wms/contracts';
import { ProDescriptions } from '@ant-design/pro-components';
import { RequestError } from '../../components/RequestError';
import { webListKeys } from './keys';
import { AuditRawPanel } from '../audit/raw-panel';
import { AuditEvents, AuditEventContinuation } from '../audit/events';
import { auditCopy as t } from '../audit/text';
import { Card, EmptyState, SectionTitle } from '../../components/ui';
import { spacing } from '../../theme/design-tokens';
export function AuditDetail({ id, onClose }: { id: string; onClose: () => void }) {
  const query = useQuery(webListKeys.auditDetail(id));
  return (
    <Drawer open title={t.detail} size={720} onClose={onClose}>
      {query.error ? (
        <RequestError error={query.error} action={<Button onClick={() => void query.refetch()}>{t.retry}</Button>} />
      ) : !query.data ? (
        <Skeleton active />
      ) : (
        <AuditDetailBody key={query.data.id} entry={query.data} />
      )}
    </Drawer>
  );
}
function AuditDetailBody({ entry }: { entry: WebAuditDetail }) {
  const [expanded, setExpanded] = useState<string[]>([]);
  return (
    <div style={{ display: 'grid', gap: spacing[16] }}>
      <Card padding="large">
        <ProDescriptions
          column={1}
          dataSource={entry}
          columns={[
            { title: t.action, dataIndex: 'action' },
            { title: t.object, dataIndex: 'objectLabel' },
            { title: t.actor, dataIndex: 'actor' },
            { title: t.time, render: () => listTime(entry.createdAt) },
            { title: t.channel, dataIndex: 'channel' },
            { title: t.result, render: () => <AuditResultLabel result={entry.result} /> },
          ]}
        />
      </Card>
      {['已取消', '结果待核实', '未记录'].includes(entry.result) && (
        <Alert
          showIcon
          type={entry.result === '结果待核实' ? 'warning' : 'info'}
          title={
            entry.result === '已取消'
              ? t.cancelledHelp
              : entry.result === '结果待核实'
                ? t.uncertainHelp
                : t.missingHelp
          }
        />
      )}
      <Card padding="large" title={<SectionTitle title={t.field} />}>
        <Table
          rowKey="field"
          size="small"
          pagination={false}
          dataSource={entry.changes}
          locale={{ emptyText: <EmptyState description={t.changesEmpty} /> }}
          columns={[
            { title: t.field, dataIndex: 'label' },
            { title: t.before, dataIndex: 'before' },
            { title: t.after, dataIndex: 'after' },
            { title: t.unit, dataIndex: 'unit' },
          ]}
        />
      </Card>
      <Card padding="compact">
        <Collapse
          activeKey={expanded}
          onChange={(keys) => setExpanded(Array.isArray(keys) ? keys : [keys])}
          items={[
            {
              key: 'related',
              label: t.related,
              children: (
                <>
                  <AuditEvents items={entry.related.items} design />
                  {entry.related.nextCursor && (
                    <AuditEventContinuation id={entry.id} cursor={entry.related.nextCursor} related design />
                  )}
                </>
              ),
            },
            { key: 'raw', label: t.raw, children: expanded.includes('raw') ? <AuditRawPanel id={entry.id} /> : null },
          ]}
        />
      </Card>
    </div>
  );
}
