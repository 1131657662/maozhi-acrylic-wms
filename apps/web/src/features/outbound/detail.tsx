import { Link, useParams } from '@umijs/max';
import { Alert, Button, Card, Skeleton, Steps, Space } from 'antd';
import { ProDescriptions } from '@ant-design/pro-components';
import { tonnes } from '@wms/contracts';
import { useOrder } from './use-order';
import { StatusNotice, StatusTag } from '../../components/StatusTag';
import { Facts } from './facts';
import { Confirm } from './confirm';
import { formatTime } from '../../lib/format-time';
import { ListBackLink } from '../../components/BusinessList/navigation';

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
          <span className="eyebrow">OUTBOUND DETAIL</span>
          <h1>{order.orderNo}</h1>
        </div>
        <Space>
          {order.status === 'open' && order.facts.length === 0 && (
            <Link to={`/outbound/${order.id}/edit`}>
              <Button>编辑计划</Button>
            </Link>
          )}
          <StatusTag status={order.status} />
        </Space>
      </div>
      <StatusNotice status={order.status} kind="outbound" />
      {['open', 'frozen', 'confirmed'].includes(order.status) && <Card>
        <Steps
          current={{ open: 0, frozen: 1, confirmed: 2 }[order.status]}
          items={[
            { title: 'PDA 扫码', description: '保存逐包实重' },
            { title: '冻结待确认', description: '事实已锁定，库存未扣减' },
            { title: 'Web 确认出库', description: '一次扣减并记录流水' },
          ]}
        />
      </Card>}
      <div className="metrics">
        <Card>
          <small>计划包数 / 扫码包数</small>
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
          <small>扫码实际重量</small>
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
            { title: '客户', dataIndex: 'customerName' },
            { title: '车牌', dataIndex: 'vehicleNo' },
            { title: '仓库', dataIndex: 'warehouseCode' },
            { title: '计划版本', dataIndex: 'planVersion' },
            { title: '事实修订号', dataIndex: 'revision' },
            { title: '建单时间', dataIndex: 'createdAt', render: () => formatTime(order.createdAt) },
          ]}
        />
        <div className="line-summary">
          {order.lines.map((line) => (
            <p key={line.id}>
              {line.productCode} · {line.productName} — 计划 {line.plannedPackages} 包 /{' '}
              {tonnes(line.plannedWeightGrams)} 吨；实扫 {line.actualPackages} 包 / {tonnes(line.actualWeightGrams)} 吨
            </p>
          ))}
        </div>
      </Card>
      <Facts order={order} />
      <Confirm order={order} />
    </section>
  );
}
