import { useState } from 'react';
import { Link } from '@umijs/max';
import { ProTable, type ProColumns } from '@ant-design/pro-components';
import { Alert, Input, Select, Button, Space } from 'antd';
import { tonnes, type Order } from '@wms/contracts';
import { useOrders } from './use-orders';
import { Status } from './status';
import { PlusOutlined } from '@ant-design/icons';

const columns: ProColumns<Order>[] = [
  {
    title: '出库单号',
    dataIndex: 'orderNo',
    render: (_, row) => <Link to={`/outbound/${row.id}`}>{row.orderNo}</Link>,
    width: 220,
  },
  { title: '客户', dataIndex: 'customerName' },
  { title: '车牌', dataIndex: 'vehicleNo' },
  { title: '计划', render: (_, row) => `${row.plannedPackages} 包 / ${tonnes(row.plannedWeightGrams)} 吨` },
  { title: '扫码实绩', render: (_, row) => `${row.actualPackages} 包 / ${tonnes(row.actualWeightGrams)} 吨` },
  {
    title: '状态',
    dataIndex: 'status',
    fixed: 'right',
    width: 120,
    render: (_, row) => <Status status={row.status} />,
  },
  {
    title: '操作',
    valueType: 'option',
    fixed: 'right',
    width: 90,
    render: (_, row) => <Link to={`/outbound/${row.id}`}>查看详情</Link>,
  },
];

export function OrderList() {
  const [filters, setFilters] = useState({ page: 1, pageSize: 10, keyword: '', status: '' });
  const { data: orders, isLoading: isLoadingOrders, error: ordersError, refetch: reloadOrders } = useOrders(filters);
  return (
    <section>
      <div className="page-title">
        <div>
          <span className="eyebrow">OUTBOUND OPERATIONS</span>
          <h1>出库工作台</h1>
          <p>核对扫码实绩，确认每一次真实出库。</p>
        </div>
        <span className="demo-label">合成数据 · 本地验证</span>
      </div>
      <div className="principle">
        <strong>扫码只记录事实</strong>
        <span>冻结后等待本工作台确认，才会扣减库存。</span>
      </div>
      {ordersError && (
        <Alert
          type="error"
          title={ordersError.message}
          action={<Button onClick={() => void reloadOrders()}>重试</Button>}
        />
      )}
      <ProTable<Order>
        rowKey="id"
        columns={columns}
        dataSource={orders?.items}
        loading={isLoadingOrders}
        search={false}
        options={false}
        headerTitle="出库计划"
        toolBarRender={() => [
          <Link key="create" to="/outbound/new">
            <Button type="primary" icon={<PlusOutlined />}>
              新建计划
            </Button>
          </Link>,
        ]}
        scroll={{ x: 950 }}
        columnsState={{ persistenceKey: 'outbound-v1', persistenceType: 'localStorage' }}
        pagination={{
          current: filters.page,
          pageSize: filters.pageSize,
          total: orders?.total,
          showSizeChanger: false,
          onChange: (page) => setFilters({ ...filters, page }),
        }}
        toolbar={{
          filter: (
            <Space>
              <Input.Search
                aria-label="搜索出库单"
                placeholder="出库单号前缀"
                allowClear
                onSearch={(keyword) => setFilters({ ...filters, keyword, page: 1 })}
              />
              <Select
                aria-label="状态筛选"
                value={filters.status}
                onChange={(status) => setFilters({ ...filters, status, page: 1 })}
                options={[
                  { value: '', label: '全部状态' },
                  { value: 'open', label: '待扫码' },
                  { value: 'frozen', label: '待出库确认' },
                  { value: 'confirmed', label: '已出库' },
                ]}
              />
              <Button onClick={() => void reloadOrders()}>刷新</Button>
            </Space>
          ),
        }}
      />
    </section>
  );
}
