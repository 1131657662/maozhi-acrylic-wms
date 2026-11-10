import { useState } from 'react';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { ProFormText } from '@ant-design/pro-components';
import { BusinessList } from '../../components/BusinessList';
import { ListFilters, ListDateFilter } from '../../components/BusinessList/filters';
import { useListState } from '../../components/BusinessList/use-list-state';
import { webListKeys } from '../web-lists/keys';
import { auditColumns } from '../web-lists/audit-columns';
import { AuditDetail } from '../web-lists/audit-detail';

export function Audit() {
  const state = useListState();
  const query = useQuery({ ...webListKeys.audit(state.params), placeholderData: keepPreviousData });
  const [selected, setSelected] = useState<number | null>(null);
  return (
    <>
      <BusinessList
        state={state}
        query={query}
        config={{
          name: 'audit',
          title: '操作记录',
          columns: auditColumns(setSelected),
          description: '按时间与业务对象追溯操作，查看操作前后值。此处只读，不执行撤销。',
        }}
        filters={
          <ListFilters state={state}>
            <ListDateFilter label="操作时间" />
            <ProFormText name="action" label="操作类型" placeholder="如 inbound.confirm" />
            <ProFormText name="target" label="业务对象" placeholder="单据 ID 或商品编码" />
            <ProFormText name="traceId" label="请求编号" placeholder="支持部分请求编号" />
          </ListFilters>
        }
      />
      {selected !== null && <AuditDetail id={selected} onClose={() => setSelected(null)} />}
    </>
  );
}
