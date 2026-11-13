import { documentExtraCopy } from '@wms/contracts';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { Link } from '@umijs/max';
import { Button } from 'antd';
import { ProFormText, ProFormSelect } from '@ant-design/pro-components';
import { outboundBillTypeOptions } from '@wms/contracts';
import { BusinessList } from '../../components/BusinessList';
import {
  ListFilters,
  ListDateFilter,
  ProductReverseFilters,
  WarehouseFilter,
} from '../../components/BusinessList/filters';
import { StatusFilter } from '../../components/BusinessList/status-filter';
import { ExportOutlined } from '@ant-design/icons';
import { useListState } from '../../components/BusinessList/use-list-state';
import { webListKeys } from '../web-lists/keys';
import { outboundColumns } from './list-columns';

export function OrderList() {
  const state = useListState();
  const query = useQuery({ ...webListKeys.outbound(state.params), placeholderData: keepPreviousData });
  return (
    <BusinessList
      state={state}
      query={query}
      config={{
        name: 'outbound',
        designShell: true,
        designViewToolbar: true,
        icon: <ExportOutlined />,
        title: '出库工作台',
        columns: outboundColumns,
        description: '扫码仅记录收发情况，核对并确认出库后才扣减库存。计划数量和扫码数量分别展示。',
        extra: (
          <Link to="/outbound/new">
            <Button type="primary">新建计划</Button>
          </Link>
        ),
      }}
      filters={
        <ListFilters state={state} documentKind="outbound">
          <ProFormText
            name="keyword"
            label="出库单号"
            placeholder="支持部分单号"
            fieldProps={{ type: 'search', 'aria-label': '搜索出库单' }}
          />
          <ProFormSelect
            name="billType"
            label={documentExtraCopy.billType}
            placeholder={documentExtraCopy.allTypes}
            options={[...outboundBillTypeOptions]}
          />
          <ListDateFilter key="dateRange" label="建单时间" />
          <ProFormText name="customer" label="客户" placeholder="名称或编码" />
          <WarehouseFilter key="warehouse" />
          <ProductReverseFilters key="productCodes" />
          <ProFormText name="vehicle" label="车牌" placeholder="支持部分车牌" />
          <StatusFilter key="statusChoice" kind="outbound" />
        </ListFilters>
      }
    />
  );
}
