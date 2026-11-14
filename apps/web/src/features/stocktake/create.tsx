import { AuditOutlined } from '@ant-design/icons';
import { fontSize, spacing } from '../../theme/design-tokens';
import { useSubmitLock } from '../../components/form-protection/use-submit-lock';
import { useFormErrors } from '../../components/use-form-errors';
import { useFormDraft } from '../../components/form-protection/use-form-draft';
import { businessCopy } from '../../business-copy';
import { RequestError } from '../../components/RequestError';
import { Form, Alert, Button } from 'antd';
import { PageContainer, ProForm, ProFormSelect } from '@ant-design/pro-components';
import { Link, useNavigate } from '@umijs/max';
import { masterItemsSchema, stocktakeCopy, type CreateStocktake } from '@wms/contracts';
import { MasterSelect } from '../master-data/select';
import { useCreateStocktake } from './use-create-stocktake';
import { request } from '../../api/client';

export function StocktakeCreate() {
  const navigate = useNavigate();
  const [form] = Form.useForm();
  const draft = useFormDraft(form, `stocktake`, 'new');
  const lock = useSubmitLock();
  const { mutateAsync: create, isPending: isCreating, error: createError } = useCreateStocktake();
  useFormErrors(createError, form);
  async function submit(values: CreateStocktake) {
    try {
      const take = await create({
        ...values,
        productCodes: values.productCodes?.length ? values.productCodes : undefined,
      });
      draft.saved();
      navigate(`/stocktakes/${take.id}`);
      return true;
    } catch {
      return false;
    }
  }
  return (
    <PageContainer
      title={
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: spacing[4] }}>
          <AuditOutlined style={{ fontSize: fontSize.cardTitle }} />
          新建库存盘点
        </span>
      }
      content={businessCopy.stocktakeCreate1}
      extra={
        <Link to="/stocktakes">
          <Button>返回盘点列表</Button>
        </Link>
      }
    >
      <Alert type="warning" showIcon title="开始后暂停该仓库存写入" description={businessCopy.stocktakeCreate2} />
      {createError && <RequestError type="error" error={createError} description="已填内容保留，可修正后重试。" />}
      <ProForm<CreateStocktake>
        initialValues={{ mode: 'open' }}
        form={form}
        onValuesChange={draft.change}
        onFinish={(values) => lock.run(() => submit(values))}
        loading={lock.busy || isCreating}
        disabled={lock.busy || isCreating}
        submitter={{
          submitButtonProps: lock.button,
          resetButtonProps: false,
          searchConfig: { submitText: lock.text(businessCopy.stocktakeCreate3) },
        }}
      >
        <ProForm.Item name="warehouseCode" label="盘点仓库" rules={[{ required: true }]}>
          <MasterSelect catalog="warehouses" />
        </ProForm.Item>
        <ProFormSelect
          name="mode"
          label={stocktakeCopy.mode}
          rules={[{ required: true }]}
          allowClear={false}
          options={[
            { value: 'open', label: stocktakeCopy.open },
            { value: 'blind', label: stocktakeCopy.blind },
          ]}
        />
        <ProFormSelect
          name="productCodes"
          label="库存商品范围（选填）"
          mode="multiple"
          showSearch
          debounceTime={300}
          request={async ({ keyWords }) =>
            (
              await request(
                `/stocktakes/options/products?keyword=${encodeURIComponent(keyWords ?? '')}`,
                masterItemsSchema,
              )
            ).map((p) => ({ value: p.code, label: `${p.code} · ${p.name}` }))
          }
          fieldProps={{ maxCount: 100 }}
          extra={businessCopy.stocktakeCreate4}
        />
      </ProForm>
    </PageContainer>
  );
}
