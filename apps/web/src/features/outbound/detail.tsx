import { DateCorrectionPanel } from '../date-corrections/panel';
import { ExportOutlined } from '@ant-design/icons';
import { documentExtraCopy } from '@wms/contracts';
import { Link, useParams } from '@umijs/max';
import { Alert, Button, Card, Skeleton, Space, Tag, theme } from 'antd';
import { ProDescriptions } from '@ant-design/pro-components';
import { billTypeText, snapshotText } from '@wms/contracts';
import { useOrder } from './use-order';
import { StatusNotice, StatusTag } from '../../components/StatusTag';
import { Facts } from './facts';
import { Confirm } from './confirm';
import { formatTime } from '../../lib/format-time';
import { ListBackLink } from '../../components/BusinessList/navigation';
import { LifecyclePanel } from '../document-lifecycle/panel';
import { CorrectionSummaryPanel } from '../corrections/summary';
import { CorrectionDetailActions } from '../corrections/detail-actions';
import { ObjectAuditTimeline } from '../audit/events';
import { shipmentCopy } from './shipment-copy';

export function OrderDetail() {
  const { token } = theme.useToken();
  const { id = '' } = useParams();
  const { data: order, isLoading: isLoadingOrder, error: orderError, refetch: reloadOrder } = useOrder(id);
  if (isLoadingOrder) return <Skeleton active />;
  if (orderError || !order)
    return (
      <Alert
        type="error"
        title={orderError?.message ?? '计划不存在'}
        action={<Button onClick={() => void reloadOrder()}>重试</Button>}
      />
    );
  return (
    <section style={{ display: 'flex', flexDirection: 'column', gap: token.marginMD }}>
      <ListBackLink fallback="/">← 返回出库工作台</ListBackLink>
      <div className="page-title">
        <div>
          <span className="eyebrow">出库详情</span>
          <h1>
            <ExportOutlined aria-hidden style={{ fontSize: token.fontSizeLG, marginInlineEnd: token.marginXS }} />
            {order.orderNo}
          </h1>
        </div>
        <Space>
          {order.status === 'open' && (
            <Link to={`/outbound/${order.id}/edit`}>
              <Button>编辑计划</Button>
            </Link>
          )}
          {order.status === 'open' ? (
            <Tag color="processing" data-testid="status-tag">
              {shipmentCopy.plannedStatus}
            </Tag>
          ) : (
            <StatusTag status={order.status} />
          )}
        </Space>
      </div>
      <StatusNotice status={order.status} kind="outbound" />
      <Card>
        <ProDescriptions
          title="出库信息"
          column={3}
          dataSource={order}
          columns={[
            { title: '客户', render: () => snapshotText(order.customerName) },
            { title: '车牌', dataIndex: 'vehicleNo' },
            { title: '备注', dataIndex: 'memo' },
            { title: '仓库', render: () => snapshotText(order.warehouseName) },
            { title: documentExtraCopy.billType, render: () => billTypeText('outbound', order.billType) },
            { title: documentExtraCopy.containerNo, render: () => snapshotText(order.containerNo) },
            { title: '收货人', render: () => snapshotText(order.shipToName) },
            { title: '电话', render: () => snapshotText(order.shipToPhone) },
            { title: '地址', render: () => snapshotText(order.shipToAddress) },

            { title: '建单时间', dataIndex: 'createdAt', render: () => formatTime(order.createdAt) },
            { title: '业务日期', render: () => order.effectiveBusinessDate ?? '未记录' },
          ]}
        />
      </Card>
      <Confirm key={order.id} order={order} />
      <Facts order={order} />
      {order.corrections && (
        <CorrectionSummaryPanel summary={order.corrections} number={order.orderNo} createdAt={order.createdAt} />
      )}
      <DateCorrectionPanel target={{ kind: 'outbound', id: order.id }} />
      <LifecyclePanel kind="outbound" id={order.id} />
      <ObjectAuditTimeline kind="outbound" id={order.id} />
      <CorrectionDetailActions
        primary={order.status !== 'partially_shipped'}
        kind="outbound"
        id={order.id}
        number={order.orderNo}
        allowed={order.corrections?.allowed ?? false}
      />
    </section>
  );
}
