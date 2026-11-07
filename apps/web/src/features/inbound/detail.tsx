import { Alert, Button, Skeleton } from 'antd';
import { Link, useParams } from '@umijs/max';
import { ProDescriptions, ProTable, type ProColumns } from '@ant-design/pro-components';
import { tonnes, type InboundReceipt } from '@wms/contracts';
import { formatTime } from '../../lib/format-time';
import { useReceipt } from './use-receipt';

export function InboundDetail() {
  const { id = '' } = useParams();
  const { data, isLoading, error, refetch } = useReceipt(id);
  if (isLoading) return <Skeleton active />;
  if (error || !data)
    return (
      <Alert
        type="error"
        title={error?.message ?? '入库单不存在'}
        action={<Button onClick={() => void refetch()}>重试</Button>}
      />
    );
  const columns: ProColumns<InboundReceipt['lines'][number]>[] = [
    { title: '商品编码', dataIndex: 'productCode' },
    { title: '商品名称', dataIndex: 'productName' },
    { title: '包数', dataIndex: 'packages' },
    { title: '总重量（吨）', render: (_, line) => tonnes(line.weightGrams) },
  ];
  return (
    <section>
      <Link to="/inbound">← 返回入库记录</Link>
      <div className="page-title">
        <div>
          <span className="eyebrow">INBOUND DETAIL</span>
          <h1>{data.receiptNo}</h1>
        </div>
        <span className="demo-label">已入库</span>
      </div>
      <ProDescriptions<InboundReceipt>
        title="入库信息"
        column={3}
        dataSource={data}
        columns={[
          { title: '供应商', dataIndex: 'supplierName' },
          { title: '仓库', dataIndex: 'warehouseName' },
          { title: '包数', dataIndex: 'packages' },
          { title: '总重量（吨）', render: () => tonnes(data.weightGrams) },
          { title: '登记人', dataIndex: 'createdBy' },
          { title: '登记时间', render: () => formatTime(data.createdAt) },
          { title: '备注', dataIndex: 'memo', span: 3 },
        ]}
      />
      <ProTable<InboundReceipt['lines'][number]>
        rowKey="id"
        headerTitle="商品明细"
        columns={columns}
        dataSource={data.lines}
        search={false}
        options={false}
        pagination={false}
      />
    </section>
  );
}
