import { documentExtraCopy, DOCUMENT_EXTRA_LIMITS, SNAPSHOT_MISSING_TEXT } from '@wms/contracts';
import { useSubmitLock } from '../../components/form-protection/use-submit-lock';
import { useFormDraft } from '../../components/form-protection/use-form-draft';
import { businessCopy } from '../../business-copy';
import { useFormErrors } from '../../components/use-form-errors';
import { RequestError } from '../../components/RequestError';
import { Alert, Button, Form, Skeleton, Space } from 'antd';
import { Link, useNavigate, useParams } from '@umijs/max';
import { ProForm, ProFormSelect, ProFormText, ProFormTextArea } from '@ant-design/pro-components';
import type { Detail, OutboundPlanFields } from '@wms/contracts';
import { outboundBillTypeOptions } from '@wms/contracts';
import { tonnesToGrams } from '../../lib/weight-input';
import { useOrder } from './use-order';
import { useCreatePlan } from './use-create-plan';
import { useUpdatePlan } from './use-update-plan';
import { PlanLinesFields, PlanReadOnlyLines } from './plan-fields';
import { VehicleField } from '../master-data/vehicle-field';
import { BusinessDateField } from '../business-date/field';
import { useBackdateConfirmation } from '../business-date/use-backdate-confirmation';

interface PlanFormValues extends Omit<OutboundPlanFields, 'lines' | 'orderNo' | 'billType'> {
  billType?: OutboundPlanFields['billType'];
  lines: {
    productCode?: string;
    plannedPackages?: number;
    plannedWeightTonnes?: number;
    contractNo?: string | null;
    memo?: string | null;
  }[];
  lineExtras?: { contractNo?: string | null; memo?: string | null }[];
}

export function OutboundPlanEditor() {
  const { id = '' } = useParams();
  const orderQuery = useOrder(id);
  const order = orderQuery.data;
  if (id && orderQuery.isLoading) return <Skeleton active />;
  if (orderQuery.error || (id && !order)) return <RequestError error={orderQuery.error} retry={orderQuery.refetch} />;
  if (order && order.status !== 'open')
    return (
      <Alert
        type="warning"
        title="当前计划已提交或处理完成，不能编辑。"
        action={<Link to={`/outbound/${id}`}>返回计划详情</Link>}
      />
    );

  return <LoadedPlanEditor key={id || 'new'} id={id} order={order} />;
}
function LoadedPlanEditor({ id, order }: { id: string; order?: Detail }) {
  const navigate = useNavigate();
  const create = useCreatePlan();
  const update = useUpdatePlan();
  const [form] = Form.useForm<PlanFormValues>();
  const draft = useFormDraft(form, 'outbound', id || 'new');
  const lock = useSubmitLock();
  useFormErrors(create.error ?? update.error, form);
  const confirmBackdate = useBackdateConfirmation();
  async function submit(values: PlanFormValues): Promise<boolean> {
    try {
      if (!order && !(await confirmBackdate(values.businessDate))) return false;
      const saved = order
        ? await update.mutateAsync({
            id,
            revision: order.revision,
            digest: order.digest,
            plan: {
              vehicleNo: values.vehicleNo,
              memo: values.memo ?? null,
              billType: values.billType,
              containerNo: values.containerNo,
              lines: order.lines.map((line, index) => ({
                id: line.id,
                contractNo: values.lineExtras?.[index]?.contractNo ?? line.contractNo,
                memo: values.lineExtras?.[index]?.memo ?? line.memo,
              })),
            },
          })
        : await create.mutateAsync({
            ...values,
            backdateConfirmed: true,
            lines: values.lines.map((line) => ({
              productCode: line.productCode!,
              plannedPackages: line.plannedPackages!,
              plannedWeightGrams: tonnesToGrams(line.plannedWeightTonnes!),
              contractNo: line.contractNo,
              memo: line.memo,
            })),
          });
      draft.saved();
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
          <span className="eyebrow">出库计划</span>
          <h1>{order ? '编辑出库计划' : '新建出库计划'}</h1>
          <p>{order ? documentExtraCopy.editHint : businessCopy.outboundEditor1}</p>
        </div>
      </div>
      {(create.error || update.error) && (
        <RequestError error={create.error ?? update.error} retry={() => form.submit()} />
      )}
      <ProForm<PlanFormValues>
        loading={lock.busy || create.isPending || update.isPending}
        form={form}
        onValuesChange={draft.change}
        disabled={lock.busy || create.isPending || update.isPending}
        key={id || 'new-plan'}
        initialValues={
          order
            ? {
                vehicleNo: order.vehicleNo,
                memo: order.memo,
                billType: order.billType ?? undefined,
                containerNo: order.containerNo,
                lineExtras: order.lines.map(({ contractNo, memo }) => ({ contractNo, memo })),
              }
            : { billType: 'sales' }
        }
        onFinish={(values) => lock.run(() => submit(values))}
        submitter={{
          submitButtonProps: lock.button,
          searchConfig: { submitText: lock.text(order ? '保存修改' : '创建计划'), resetText: '取消' },
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
        <ProFormSelect
          name="billType"
          label={documentExtraCopy.billType}
          options={[...outboundBillTypeOptions]}
          placeholder={order && order.billType == null ? SNAPSHOT_MISSING_TEXT : documentExtraCopy.chooseType}
          rules={order && order.billType == null ? [] : [{ required: true }]}
        />
        <ProFormText
          name="containerNo"
          label={documentExtraCopy.containerNo}
          fieldProps={{ maxLength: DOCUMENT_EXTRA_LIMITS.containerNo }}
        />
        <ProFormTextArea name="memo" label="备注" fieldProps={{ maxLength: DOCUMENT_EXTRA_LIMITS.memo, rows: 2 }} />
      </ProForm>
    </section>
  );
}
