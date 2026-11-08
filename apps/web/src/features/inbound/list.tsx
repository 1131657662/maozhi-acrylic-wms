import { useQuery } from '@tanstack/react-query';
import { Link } from '@umijs/max';
import { Button } from 'antd';
import { ProFormText, ProFormSelect } from '@ant-design/pro-components';
import { BusinessList } from '../../components/BusinessList';
import { ListFilters, ListDateFilter, WarehouseFilter } from '../../components/BusinessList/filters';
import { StatusFilter } from '../../components/BusinessList/status-filter';
import { useListState } from '../../components/BusinessList/use-list-state';
import { webListKeys } from '../web-lists/keys';
import { inboundColumns } from './list-columns';

export function InboundList() {
  const state = useListState();
  const query = useQuery(webListKeys.inbound(state.params));
  return (
    <BusinessList
      state={state}
      query={query}
      config={{
        name: 'inbound',
        title: '入库记录',
        columns: inboundColumns,
        description: '按登记时间查询。包数与总吨数独立记录；创建后须明确确认才入账。',
        extra: (
          <Link to="/inbound/new">
            <Button type="primary">登记入库</Button>
          </Link>
        ),
      }}
      filters={
        <ListFilters state={state}>
          <ProFormText
            name="keyword"
            label="入库单号"
            placeholder="支持部分单号"
            fieldProps={{ type: 'search', 'aria-label': '搜索入库单' }}
          />
          <ListDateFilter key="dateRange" label="登记时间" />
          <ProFormText name="supplier" label="供应商" placeholder="名称或编码" />
          <WarehouseFilter key="warehouse" />
          <StatusFilter key="statusChoice" kind="inbound" />
          <ProFormSelect
            name="postingState"
            label="入账状态"
            placeholder="全部入账状态"
            options={[
              { value: 'pending', label: '待确认入账' },
              { value: 'confirmed', label: '已确认入账' },
              { value: 'legacy', label: '历史记录（只读）' },
            ]}
          />
        </ListFilters>
      }
    />
  );
}
