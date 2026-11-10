import { businessCopy } from '../../business-copy';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link, useLocation } from '@umijs/max';
import { Button, Tag } from 'antd';
import {
  PageContainer,
  ProTable,
  QueryFilter,
  ProFormSelect,
  ProFormText,
  type ProColumns,
} from '@ant-design/pro-components';
import { listTime, type Stocktake } from '@wms/contracts';
import { stocktakeKeys } from './keys';
import { StocktakeQueryState } from './query-state';
import '../../components/BusinessList/style.css';

export const stocktakeStatus = { counting: '进行中 · 仓库暂停确认', completed: '已回写完成', voided: '已作废' };
const columns: ProColumns<Stocktake>[] = [
  {
    title: '盘点单号',
    dataIndex: 'number',
    width: 270,
    fixed: 'left',
    render: (_, r) => <Link to={`/stocktakes/${r.id}`}>{r.number}</Link>,
  },
  { title: '仓库', dataIndex: 'warehouseName', width: 160 },
  {
    title: '状态',
    width: 200,
    render: (_, r) => <Tag color={r.status === 'counting' ? 'warning' : 'default'}>{stocktakeStatus[r.status]}</Tag>,
  },
  { title: '实盘进度', width: 140, render: (_, r) => `${r.recordedCount} / ${r.lineCount} 行` },
  { title: '差异行', dataIndex: 'changedCount', width: 90 },
  { title: businessCopy.stocktakeList1, width: 180, render: (_, r) => listTime(r.snapshotAt) },
  { title: '操作', width: 90, fixed: 'right', render: (_, r) => <Link to={`/stocktakes/${r.id}`}>查看</Link> },
];
export function StocktakeList() {
  const location = useLocation();
  const [params, setParams] = useState<Record<string, string>>({
    page: '1',
    pageSize: '20',
    ...Object.fromEntries(new URLSearchParams(location.search)),
  });
  const query = useQuery(stocktakeKeys.list(params));
  return (
    <PageContainer
      title="库存盘点"
      className="business-list"
      content={businessCopy.stocktakeList2}
      extra={
        <Link to="/stocktakes/new">
          <Button type="primary">新建盘点</Button>
        </Link>
      }
    >
      <QueryFilter
        initialValues={params}
        onFinish={async (values) => {
          setParams({
            page: '1',
            pageSize: params.pageSize!,
            ...Object.fromEntries(Object.entries(values).filter(([, v]) => v)),
          });
        }}
        onReset={() => setParams({ page: '1', pageSize: '20' })}
      >
        <ProFormText name="keyword" label="盘点单号" />
        <ProFormSelect
          name="status"
          label="状态"
          options={Object.entries(stocktakeStatus).map(([value, label]) => ({ value, label }))}
        />
      </QueryFilter>
      <StocktakeQueryState query={query}>
        <ProTable<Stocktake>
          rowKey="id"
          columns={columns}
          dataSource={query.data?.items ?? []}
          headerTitle="盘点记录"
          search={false}
          options={false}
          scroll={{ x: 1130 }}
          loading={query.isFetching}
          locale={{ emptyText: '暂无盘点单，点击“新建盘点”开始。' }}
          pagination={{
            current: Number(params.page),
            pageSize: Number(params.pageSize),
            total: query.data?.total,
            showSizeChanger: true,
            pageSizeOptions: [20, 50, 100, 200],
            onChange: (page, pageSize) => setParams({ ...params, page: String(page), pageSize: String(pageSize) }),
          }}
        />
      </StocktakeQueryState>
    </PageContainer>
  );
}
