import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Segmented } from 'antd';
import { AuditOutlined } from '@ant-design/icons';
import { BusinessList } from '../../components/BusinessList';
import { useListState } from '../../components/BusinessList/use-list-state';
import { webListKeys } from '../web-lists/keys';
import { auditColumns } from '../web-lists/audit-columns';
import { AuditDetail } from '../web-lists/audit-detail';
import { AuditTimelineView } from '../audit/timeline-view';
import { AuditStatistics } from '../audit/statistics';
import { AuditFilters } from '../audit/filters';
import { AuditEmpty } from '../audit/empty';
import { auditDateDefaults } from '../audit/dates';
import { auditCopy as t } from '../audit/text';
import { Toolbar } from '../../components/ui';

function filterScope(params: Record<string, string>) {
  return JSON.stringify(
    Object.entries(params)
      .filter(([key]) => !['page', 'pageSize', 'sortBy', 'direction'].includes(key))
      .sort(),
  );
}

export function Audit() {
  const state = useListState('createdAt', {}, auditDateDefaults());
  const query = useQuery({
    ...webListKeys.audit(state.params),
    placeholderData: (previous, previousQuery) => {
      const params = previousQuery?.queryKey.at(-1);
      return params &&
        typeof params === 'object' &&
        filterScope(params as Record<string, string>) === filterScope(state.params)
        ? previous
        : undefined;
    },
  });
  const [selected, setSelected] = useState<string | null>(null),
    [view, setView] = useState('list');
  return (
    <>
      <BusinessList
        state={state}
        query={query}
        config={{
          name: 'audit',
          designShell: true,
          title: t.title,
          icon: <AuditOutlined />,
          description: t.description,
          columns: auditColumns(setSelected),
          emptyText: <AuditEmpty />,
          skeleton: true,
          exportInHeader: true,
          onExportOpen: () => setView('list'),
        }}
        filters={<AuditFilters state={state} />}
        beforeResults={
          <>
            <AuditStatistics
              data={query.error ? undefined : query.data?.statistics}
              filter={(patch) => state.change({ ...patch, page: '1' })}
            />
            <Toolbar>
              <Segmented
                aria-label={t.timeline}
                value={view}
                onChange={(value) => {
                  setView(value);
                  state.change({ page: '1' });
                }}
                options={[
                  { label: t.list, value: 'list' },
                  { label: t.timeline, value: 'timeline' },
                ]}
              />
            </Toolbar>
          </>
        }
        resultView={
          view === 'timeline' ? (
            <AuditTimelineView params={state.params} onPage={(page) => state.change({ page: String(page) })} />
          ) : undefined
        }
      />
      {selected !== null && <AuditDetail id={selected} onClose={() => setSelected(null)} />}
    </>
  );
}
