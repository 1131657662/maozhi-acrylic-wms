import { useQuery } from '@tanstack/react-query';
import { Link } from '@umijs/max';
import { Button } from 'antd';
import { ProFormText } from '@ant-design/pro-components';
import { BusinessList } from '../../components/BusinessList';
import { ListFilters, ListDateFilter, WarehouseFilter } from '../../components/BusinessList/filters';
import { StatusFilter } from '../../components/BusinessList/status-filter';
import { useListState } from '../../components/BusinessList/use-list-state';
import { webListKeys } from '../web-lists/keys';
import { outboundColumns } from './list-columns';

export function OrderList() {
  const state = useListState();
  const query = useQuery(webListKeys.outbound(state.params));
  return (
    <BusinessList
      state={state}
      query={query}
      config={{
        name: 'outbound',
        title: '出库工作台',
        columns: outboundColumns,
        description: '扫码与冻结只记录事实，Web 明确确认才扣减库存。计划与实扫分别展示。',
        extra: (
          <Link to="/outbound/new">
            <Button type="primary">新建计划</Button>
          </Link>
        ),
      }}
      filters={
        <ListFilters state={state}>
          <ProFormText
            name="keyword"
            label="出库单号"
            placeholder="支持部分单号"
            fieldProps={{ type: 'search', 'aria-label': '搜索出库单' }}
          />
          <ListDateFilter key="dateRange" label="建单时间" />
          <ProFormText name="customer" label="客户" placeholder="名称或编码" />
          <WarehouseFilter key="warehouse" />
          <ProFormText name="vehicle" label="车牌" placeholder="支持部分车牌" />
          <StatusFilter key="statusChoice" kind="outbound" />
        </ListFilters>
      }
    />
  );
}
