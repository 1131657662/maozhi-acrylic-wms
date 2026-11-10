import { RequestError } from '../../components/RequestError';
import { Button, Result, Skeleton, Space, theme } from 'antd';
import { useParams } from '@umijs/max';
import { PageContainer, ProDescriptions, ProTable, type ProColumns } from '@ant-design/pro-components';
import { tonnes, snapshotText, type InboundReceipt } from '@wms/contracts';
import { formatTime } from '../../lib/format-time';
import { useReceipt } from './use-receipt';
import { StatusNotice, StatusTag } from '../../components/StatusTag';
import { InboundConfirmation } from './confirm';
import { ApiError } from '../../api/client';
import { ListBackLink } from '../../components/BusinessList/navigation';
import { LifecyclePanel } from '../document-lifecycle/panel';
import { CorrectionSummaryPanel } from '../corrections/summary';
import { CorrectionDetailActions } from '../corrections/detail-actions';

export function InboundDetail() {
  const { id = '' } = useParams();
  const { data, isLoading, error, refetch } = useReceipt(id);
  const { token } = theme.useToken();
  const columns: ProColumns<InboundReceipt['lines'][number]>[] = [
    { title: '商品编码', dataIndex: 'productCode' },
    { title: '商品名称', dataIndex: 'productName' },
    { title: '型号', render: (_, line) => snapshotText(line.productModel) },
    { title: '包数', dataIndex: 'packages' },
    { title: '总重量（吨）', render: (_, line) => tonnes(line.weightGrams) },
  ];
  return (
    <PageContainer
      title={<h1 style={{ fontSize: token.fontSizeHeading4, margin: 0 }}>{data?.receiptNo ?? '入库单详情'}</h1>}
      token={{ paddingInlinePageContainerContent: token.paddingLG }}
      extra={
        <Space>
          <ListBackLink fallback="/inbound">返回入库记录</ListBackLink>
          {data && <StatusTag status={data.status} kind="inbound" />}
        </Space>
      }
    >
      {isLoading ? (
        <div role="status" aria-label="正在加载入库单">
          <Skeleton active />
        </div>
      ) : error instanceof ApiError && error.status === 403 ? (
        <Result status="403" title="当前账号无权查看此入库单" />
      ) : error || !data ? (
        <RequestError
          type="error"
          showIcon
          error={error}
          action={<Button onClick={() => void refetch()}>重试</Button>}
        />
      ) : (
        <Space orientation="vertical" size={token.margin} style={{ width: '100%' }}>
          <StatusNotice status={data.status} kind="inbound" />
          <InboundConfirmation key={data.id} receipt={data} />
          <ProDescriptions<InboundReceipt>
            title="入库信息"
            column={3}
            dataSource={data}
            columns={[
              { title: '供应商', dataIndex: 'supplierName' },
              { title: '仓库', dataIndex: 'warehouseName' },
              { title: '送货人', render: () => snapshotText(data.deliveryName) },
              { title: '电话', render: () => snapshotText(data.deliveryPhone) },
              { title: '地址', render: () => snapshotText(data.deliveryAddress) },
              { title: '包数', dataIndex: 'packages' },
              { title: '总重量（吨）', render: () => tonnes(data.weightGrams) },
              { title: '登记人', dataIndex: 'createdBy' },
              { title: '登记时间', render: () => formatTime(data.createdAt) },
              { title: '业务日期', render: () => data.businessDate ?? '未记录' },
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
          {data.corrections && (
            <CorrectionSummaryPanel summary={data.corrections} number={data.receiptNo} createdAt={data.createdAt} />
          )}
          <LifecyclePanel kind="inbound" id={data.id} />
          <CorrectionDetailActions
            kind="inbound"
            id={data.id}
            number={data.receiptNo}
            allowed={data.corrections?.allowed ?? false}
          />
        </Space>
      )}
    </PageContainer>
  );
}
