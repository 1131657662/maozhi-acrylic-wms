import { Alert, Button, Result, Skeleton } from 'antd';
import { useParams } from '@umijs/max';
import { ProDescriptions, ProTable, type ProColumns } from '@ant-design/pro-components';
import { tonnes, type InboundReceipt } from '@wms/contracts';
import { formatTime } from '../../lib/format-time';
import { useReceipt } from './use-receipt';
import { StatusNotice, StatusTag } from '../../components/StatusTag';
import { InboundConfirmation } from './confirm';
import { ApiError } from '../../api/client';
import { ListBackLink } from '../../components/BusinessList/navigation';

export function InboundDetail() {
  const { id = '' } = useParams();
  const { data, isLoading, error, refetch } = useReceipt(id);
  if (isLoading) return <Skeleton active />;
  if (error instanceof ApiError && error.status === 403) return <Result status="403" title="无权确认入库" />;
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
      <ListBackLink fallback="/inbound">← 返回入库记录</ListBackLink>
      <div className="page-title">
        <div>
          <span className="eyebrow">INBOUND DETAIL</span>
          <h1>{data.receiptNo}</h1>
        </div>
        <StatusTag status={data.status} kind="inbound" />
      </div>
      <StatusNotice status={data.status} kind="inbound" />
      <InboundConfirmation key={data.id} receipt={data} />
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
