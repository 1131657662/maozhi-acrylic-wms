import { useState } from 'react';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { ProFormText, ProFormSelect } from '@ant-design/pro-components';
import { Segmented } from 'antd';
import { AuditOutlined } from '@ant-design/icons';
import { BusinessList } from '../../components/BusinessList';
import { ListFilters, ListDateFilter } from '../../components/BusinessList/filters';
import { useListState } from '../../components/BusinessList/use-list-state';
import { webListKeys } from '../web-lists/keys';
import { auditColumns } from '../web-lists/audit-columns';
import { AuditDetail } from '../web-lists/audit-detail';
import { AuditTimelineView } from '../audit/timeline-view';
import { auditCopy as t } from '../audit/text';
export function Audit() {
  const state = useListState();
  const query = useQuery({ ...webListKeys.audit(state.params), placeholderData: keepPreviousData });
  const [selected, setSelected] = useState<string | null>(null),
    [view, setView] = useState('list');
  return (
    <>
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
      {view === 'list' ? (
        <BusinessList
          state={state}
          query={query}
          config={{
            name: 'audit',
            title: t.title,
            icon: <AuditOutlined />,
            columns: auditColumns(setSelected),
            description: t.description,
          }}
          filters={
            <ListFilters state={state}>
              <ListDateFilter label={t.filterTime} />
              <ProFormText name="action" label={t.filterAction} placeholder={t.actionPlaceholder} />
              <ProFormText name="target" label={t.filterObject} placeholder={t.objectPlaceholder} />
              <ProFormText name="keyword" label={t.filterKeyword} placeholder={t.keywordPlaceholder} />
              <ProFormSelect name="result" label={t.result} options={t.results} />
            </ListFilters>
          }
        />
      ) : (
        <AuditTimelineView params={state.params} onPage={(page) => state.change({ page: String(page) })} />
      )}
      {selected !== null && <AuditDetail id={selected} onClose={() => setSelected(null)} />}
    </>
  );
}
