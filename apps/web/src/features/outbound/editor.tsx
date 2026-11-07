import { Alert, Button, Skeleton, Space } from 'antd';
import { Link, useNavigate, useParams } from '@umijs/max';
import { ProForm, ProFormDigit, ProFormList, ProFormSelect, ProFormText } from '@ant-design/pro-components';
import type { Detail, OutboundPlanFields } from '@wms/contracts';
import { gramsToTonnes, tonnesToGrams } from '../../lib/weight-input';
import { useMasterItems } from '../master-data/use-master-items';
import { useOrder } from './use-order';
import { useCreatePlan } from './use-create-plan';
import { useUpdatePlan } from './use-update-plan';

interface PlanFormValues extends Omit<OutboundPlanFields, 'lines'> {
  lines: { productCode?: string; plannedPackages?: number; plannedWeightTonnes?: number }[];
}

function options(items: { code: string; name: string; active: boolean }[] | undefined) {
  return (items ?? [])
    .filter((item) => item.active)
    .map((item) => ({ value: item.code, label: `${item.code} · ${item.name}` }));
}

function toInitialValues(order: Detail | undefined): PlanFormValues | undefined {
  if (!order) return undefined;
  return {
    orderNo: order.orderNo,
    customerCode: order.customerCode,
    warehouseCode: order.warehouseCode,
    vehicleNo: order.vehicleNo,
    lines: order.lines.map((line) => ({
      productCode: line.productCode,
      plannedPackages: line.plannedPackages,
      plannedWeightTonnes: gramsToTonnes(line.plannedWeightGrams),
    })),
  };
}

export function OutboundPlanEditor() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const editing = Boolean(id);
  const orderQuery = useOrder(id);
  const customers = useMasterItems('customers');
  const warehouses = useMasterItems('warehouses');
  const products = useMasterItems('products');
  const create = useCreatePlan();
  const update = useUpdatePlan();
  const order = orderQuery.data;
  const loading =
    customers.isLoading || warehouses.isLoading || products.isLoading || (editing && orderQuery.isLoading);
  const error = customers.error ?? warehouses.error ?? products.error ?? orderQuery.error;
  if (loading) return <Skeleton active />;
  if (error || (editing && !order)) return <Alert type="error" title={error?.message ?? '出库计划不存在'} />;
  if (order && (order.status !== 'open' || order.facts.length > 0))
    return (
      <Alert
        type="warning"
        title="当前计划已开始扫码或已冻结，不能再编辑。"
        action={<Link to={`/outbound/${id}`}>返回计划详情</Link>}
      />
    );
  async function submit(values: PlanFormValues): Promise<boolean> {
    try {
      const plan: OutboundPlanFields = {
        ...values,
        lines: values.lines.map((line) => ({
          productCode: line.productCode!,
          plannedPackages: line.plannedPackages!,
          plannedWeightGrams: tonnesToGrams(line.plannedWeightTonnes!),
        })),
      };
      const saved = order
        ? await update.mutateAsync({ id, revision: order.revision, digest: order.digest, plan })
        : await create.mutateAsync(plan);
      navigate(`/outbound/${saved.id}`);
      return true;
    } catch (reason) {
      return Promise.reject(reason);
    }
  }
  return (
    <section>
      <div className="page-title">
        <div>
          <span className="eyebrow">OUTBOUND PLAN</span>
          <h1>{editing ? '编辑出库计划' : '新建出库计划'}</h1>
          <p>计划不会预占库存；库存仅由 Web 出库确认事务扣减。</p>
        </div>
      </div>
      {(create.error || update.error) && <Alert type="error" title={(create.error ?? update.error)?.message} />}
      <ProForm<PlanFormValues>
        key={id || 'new-plan'}
        initialValues={toInitialValues(order)}
        onFinish={submit}
        submitter={{
          searchConfig: { submitText: editing ? '保存修改' : '创建计划', resetText: '取消' },
          render: (_, dom) => (
            <Space>
              <Link to={order ? `/outbound/${order.id}` : '/'}>
                <Button>取消</Button>
              </Link>
              {dom[1]}
            </Space>
          ),
        }}
      >
        <ProFormText name="orderNo" label="出库单号" rules={[{ required: true }]} fieldProps={{ maxLength: 100 }} />
        <ProFormSelect
          name="customerCode"
          label="客户"
          rules={[{ required: true }]}
          options={options(customers.data)}
          showSearch
        />
        <ProFormSelect
          name="warehouseCode"
          label="仓库"
          rules={[{ required: true }]}
          options={options(warehouses.data)}
          showSearch
        />
        <ProFormText
          name="vehicleNo"
          label="车牌 / 车辆标识"
          rules={[{ required: true }]}
          fieldProps={{ maxLength: 100 }}
        />
        <ProFormList
          name="lines"
          label="计划明细"
          initialValue={[{}]}
          min={1}
          creatorButtonProps={{ creatorButtonText: '添加商品' }}
        >
          <ProFormSelect
            name="productCode"
            label="商品"
            rules={[{ required: true }]}
            options={options(products.data)}
            showSearch
          />
          <ProFormDigit
            name="plannedPackages"
            label="计划包数"
            rules={[{ required: true }]}
            fieldProps={{ min: 1, precision: 0, step: 1 }}
          />
          <ProFormDigit
            name="plannedWeightTonnes"
            label="计划重量（吨）"
            rules={[{ required: true }]}
            fieldProps={{ min: 0.0001, max: 99999999.9999, precision: 4, step: 0.0001 }}
          />
        </ProFormList>
      </ProForm>
    </section>
  );
}
