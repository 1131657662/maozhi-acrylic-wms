import { Alert, Button, Skeleton, Space } from 'antd';
import { Link, useNavigate, useParams } from '@umijs/max';
import { ProForm, ProFormTextArea } from '@ant-design/pro-components';
import type { OutboundPlanFields } from '@wms/contracts';
import { tonnesToGrams } from '../../lib/weight-input';
import { useOrder } from './use-order';
import { useCreatePlan } from './use-create-plan';
import { useUpdatePlan } from './use-update-plan';
import { PlanLinesFields, PlanReadOnlyLines } from './plan-fields';
import { VehicleField } from '../master-data/vehicle-field';
import { BusinessDateField } from '../business-date/field';
import { useBackdateConfirmation } from '../business-date/use-backdate-confirmation';

interface PlanFormValues extends Omit<OutboundPlanFields, 'lines' | 'orderNo'> {
  lines: { productCode?: string; plannedPackages?: number; plannedWeightTonnes?: number }[];
}

export function OutboundPlanEditor() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const orderQuery = useOrder(id);
  const create = useCreatePlan();
  const update = useUpdatePlan();
  const confirmBackdate = useBackdateConfirmation();
  const order = orderQuery.data;
  if (id && orderQuery.isLoading) return <Skeleton active />;
  if (orderQuery.error || (id && !order))
    return <Alert type="error" title={orderQuery.error?.message ?? '出库计划不存在'} />;
  if (order && order.status !== 'open')
    return (
      <Alert
        type="warning"
        title="当前计划已冻结或进入终态，不能编辑。"
        action={<Link to={`/outbound/${id}`}>返回计划详情</Link>}
      />
    );

  async function submit(values: PlanFormValues): Promise<boolean> {
    try {
      if (!order && !(await confirmBackdate(values.businessDate))) return false;
      const saved = order
        ? await update.mutateAsync({
            id,
            revision: order.revision,
            digest: order.digest,
            plan: { vehicleNo: values.vehicleNo, memo: values.memo ?? null },
          })
        : await create.mutateAsync({
            ...values,
            backdateConfirmed: true,
            lines: values.lines.map((line) => ({
              productCode: line.productCode!,
              plannedPackages: line.plannedPackages!,
              plannedWeightGrams: tonnesToGrams(line.plannedWeightTonnes!),
            })),
          });
      navigate(`/outbound/${saved.id}`);
      return true;
    } catch {
      return false;
    }
  }
  return (
    <section>
      <div className="page-title">
        <div>
          <span className="eyebrow">OUTBOUND PLAN</span>
          <h1>{order ? '编辑出库计划' : '新建出库计划'}</h1>
          <p>
            {order
              ? '只能修改车号和备注，客户、仓库及明细保持不变。'
              : '计划不会预占库存；库存仅由 Web 出库确认事务扣减。'}
          </p>
        </div>
      </div>
      {(create.error || update.error) && <Alert type="error" title={(create.error ?? update.error)?.message} />}
      <ProForm<PlanFormValues>
        loading={create.isPending || update.isPending}
        key={id || 'new-plan'}
        initialValues={order ? { vehicleNo: order.vehicleNo, memo: order.memo } : undefined}
        onFinish={submit}
        submitter={{
          searchConfig: { submitText: order ? '保存修改' : '创建计划', resetText: '取消' },
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
        <ProForm.Item label="出库单号">
          <span>{order?.orderNo ?? '创建成功后自动生成 CK 单号'}</span>
        </ProForm.Item>
        {order ? <PlanReadOnlyLines order={order} /> : <PlanLinesFields />}
        {!order && <BusinessDateField />}
        <VehicleField />
        <ProFormTextArea name="memo" label="备注" fieldProps={{ maxLength: 500, rows: 2 }} />
      </ProForm>
    </section>
  );
}
