import { Link, useParams } from '@umijs/max';
import { Alert, Button, Card, Skeleton, Space } from 'antd';
import { ProDescriptions } from '@ant-design/pro-components';
import { tonnes, snapshotText } from '@wms/contracts';
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

export function OrderDetail() {
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
    <section>
      <ListBackLink fallback="/">← 返回出库工作台</ListBackLink>
      <div className="page-title">
        <div>
          <span className="eyebrow">出库详情</span>
          <h1>{order.orderNo}</h1>
        </div>
        <Space>
          {order.status === 'open' && (
            <Link to={`/outbound/${order.id}/edit`}>
              <Button>编辑计划</Button>
            </Link>
          )}
          <StatusTag status={order.status} />
        </Space>
      </div>
      <StatusNotice status={order.status} kind="outbound" />
      <div className="metrics">
        <Card>
          <small>计划包数 / 实发包数</small>
          <h2>
            {order.plannedPackages} / {order.actualPackages}
            <small> 包</small>
          </h2>
        </Card>
        <Card>
          <small>计划重量</small>
          <h2>
            {tonnes(order.plannedWeightGrams)}
            <small> 吨</small>
          </h2>
        </Card>
        <Card>
          <small>实发重量</small>
          <h2>
            {tonnes(order.actualWeightGrams)}
            <small> 吨</small>
          </h2>
        </Card>
      </div>
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
            { title: '收货人', render: () => snapshotText(order.shipToName) },
            { title: '电话', render: () => snapshotText(order.shipToPhone) },
            { title: '地址', render: () => snapshotText(order.shipToAddress) },

            { title: '建单时间', dataIndex: 'createdAt', render: () => formatTime(order.createdAt) },
            { title: '业务日期', render: () => order.businessDate ?? '未记录' },
          ]}
        />
      </Card>
      <Confirm key={`${order.id}:${order.status}`} order={order} />
      <Facts order={order} />
      {order.corrections && (
        <CorrectionSummaryPanel summary={order.corrections} number={order.orderNo} createdAt={order.createdAt} />
      )}
      <LifecyclePanel kind="outbound" id={order.id} />
      <ObjectAuditTimeline kind="outbound" id={order.id} />
      <CorrectionDetailActions
        kind="outbound"
        id={order.id}
        number={order.orderNo}
        allowed={order.corrections?.allowed ?? false}
      />
    </section>
  );
}
