import { useState } from 'react';
import { Link } from '@umijs/max';
import { ProTable, type ProColumns } from '@ant-design/pro-components';
import { Alert, Input, Button } from 'antd';
import { tonnes, type InboundReceipt } from '@wms/contracts';
import { formatTime } from '../../lib/format-time';
import { useReceipts } from './use-receipts';
import { StatusTag } from '../../components/StatusTag';

export function InboundList() {
  const [filters, setFilters] = useState({ page: 1, pageSize: 10, keyword: '' });
  const { data, isLoading, error, refetch } = useReceipts(filters);
  const columns: ProColumns<InboundReceipt>[] = [
    {
      title: '入库单号',
      dataIndex: 'receiptNo',
      width: 220,
      render: (_, row) => <Link to={`/inbound/${row.id}`}>{row.receiptNo}</Link>,
    },
    { title: '供应商', dataIndex: 'supplierName' },
    { title: '仓库', dataIndex: 'warehouseName' },
    { title: '状态', render: (_, row) => <StatusTag status={row.status} kind="inbound" /> },
    {
      title: '商品明细',
      render: (_, row) => row.lines.map((line) => `${line.productName} × ${line.packages} 包`).join('；'),
    },
    { title: '包数', dataIndex: 'packages', width: 100 },
    { title: '总重量（吨）', render: (_, row) => tonnes(row.weightGrams), width: 130 },
    { title: '入库时间', dataIndex: 'createdAt', render: (_, row) => formatTime(row.createdAt), width: 180 },
  ];
  return (
    <section>
      <div className="page-title">
        <div>
          <span className="eyebrow">INBOUND RECEIPTS</span>
          <h1>入库记录</h1>
          <p>每个商品独立记录包数与总吨数，不采集入库条码。</p>
        </div>
        <Link to="/inbound/new">
          <Button type="primary">登记入库</Button>
        </Link>
      </div>
      {error && (
        <Alert type="error" title={error.message} action={<Button onClick={() => void refetch()}>重试</Button>} />
      )}
      <ProTable<InboundReceipt>
        rowKey="id"
        columns={columns}
        dataSource={data?.items}
        loading={isLoading}
        search={false}
        options={false}
        headerTitle="入库单"
        scroll={{ x: 1050 }}
        pagination={{
          current: filters.page,
          pageSize: filters.pageSize,
          total: data?.total,
          showSizeChanger: false,
          onChange: (page) => setFilters({ ...filters, page }),
        }}
        toolbar={{
          filter: (
            <Input.Search
              aria-label="搜索入库单"
              placeholder="入库单号前缀"
              allowClear
              onSearch={(keyword) => setFilters({ ...filters, keyword, page: 1 })}
            />
          ),
        }}
      />
    </section>
  );
}
