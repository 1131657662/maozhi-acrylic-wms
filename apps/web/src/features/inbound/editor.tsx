import { useSubmitLock } from '../../components/form-protection/use-submit-lock';
import { useFormDraft } from '../../components/form-protection/use-form-draft';
import { useFormErrors } from '../../components/use-form-errors';
import { RequestError } from '../../components/RequestError';
import { Alert, Button, Form, Col, Result, Space, theme } from 'antd';
import { Link, useNavigate } from '@umijs/max';
import { PageContainer, ProForm, ProFormDigit, ProFormList, ProFormTextArea } from '@ant-design/pro-components';
import type { CreateInbound } from '@wms/contracts';
import { ApiError } from '../../api/client';
import { tonnesToGrams } from '../../lib/weight-input';
import { PartyFields } from '../master-data/party-fields';
import { MasterSelect } from '../master-data/select';
import { useCreateReceipt } from './use-create-receipt';
import { BusinessDateField } from '../business-date/field';
import { useBackdateConfirmation } from '../business-date/use-backdate-confirmation';

interface ReceiptFormValues extends Omit<CreateInbound, 'lines' | 'receiptNo'> {
  lines: { productCode?: string; packages?: number; weightTonnes?: number }[];
}

export function InboundEditor() {
  const navigate = useNavigate();
  const create = useCreateReceipt();
  const [form] = Form.useForm<ReceiptFormValues>();
  const draft = useFormDraft(form, `inbound`, 'new');
  const lock = useSubmitLock();
  useFormErrors(create.error, form);
  const confirmBackdate = useBackdateConfirmation();
  async function submit(values: ReceiptFormValues): Promise<boolean> {
    try {
      if (!(await confirmBackdate(values.businessDate))) return false;
      const input: CreateInbound = {
        ...values,
        backdateConfirmed: true,
        lines: values.lines.map((line) => ({
          productCode: line.productCode!,
          packages: line.packages!,
          weightGrams: tonnesToGrams(line.weightTonnes!),
        })),
      };
      const receipt = await create.mutateAsync(input);
      draft.saved();
      navigate(`/inbound/${receipt.id}`);
      return true;
    } catch {
      return false;
    }
  }
  const forbidden = create.error instanceof ApiError && create.error.status === 403;
  const { token } = theme.useToken();
  return (
    <PageContainer
      title={<h1 style={{ fontSize: token.fontSizeHeading4, margin: 0 }}>登记入库</h1>}
      token={{ paddingInlinePageContainerContent: token.paddingLG }}
      content="先创建待确认单据，核对实物后明确确认才计入库存。"
      extra={
        <Link to="/inbound">
          <Button>返回入库记录</Button>
        </Link>
      }
    >
      {forbidden ? (
        <Result
          status="403"
          title="当前账号无权登记入库"
          extra={
            <Link to="/inbound">
              <Button>返回入库记录</Button>
            </Link>
          }
        />
      ) : (
        <>
          <Alert
            type="info"
            showIcon
            title="重量独立录入"
            description="逐项填写包数和该商品本次入库总吨数；不按统一件重换算。"
            style={{ marginBottom: token.margin }}
          />
          {create.error && (
            <RequestError error={create.error} retry={() => form.submit()} style={{ marginBottom: token.margin }} />
          )}
          <ProForm<ReceiptFormValues>
            loading={lock.busy || create.isPending}
            form={form}
            onValuesChange={draft.change}
            grid
            rowProps={{ gutter: token.marginLG }}
            disabled={lock.busy || create.isPending}
            onFinish={(values) => lock.run(() => submit(values))}
            submitter={{
              submitButtonProps: lock.button,
              searchConfig: { submitText: lock.text('创建待确认入库单'), resetText: '取消' },
              render: (_, dom) => (
                <Space>
                  <Link to="/inbound">
                    <Button>取消</Button>
                  </Link>
                  {dom[1]}
                </Space>
              ),
            }}
          >
            <ProForm.Group title="单据信息">
              <Col span={24}>
                <ProForm.Item label="入库单号">
                  <span>确认保存后自动生成 RK 单号</span>
                </ProForm.Item>
              </Col>
              <Col xs={24} md={12}>
                <PartyFields partyType="supplier" />
              </Col>
              <Col xs={24} md={12}>
                <ProForm.Item name="warehouseCode" label="仓库" rules={[{ required: true }]}>
                  <MasterSelect catalog="warehouses" />
                </ProForm.Item>
              </Col>
              <ProFormTextArea
                name="memo"
                label="备注"
                colProps={{ span: 24 }}
                fieldProps={{ maxLength: 500, rows: 2 }}
              />
              <Col span={24}>
                <BusinessDateField />
              </Col>
            </ProForm.Group>
            <ProForm.Group title="商品明细">
              <ProFormList
                name="lines"
                colProps={{ span: 24 }}
                initialValue={[{}]}
                min={1}
                creatorButtonProps={{ creatorButtonText: '添加商品' }}
              >
                <Col xs={24} md={12}>
                  <ProForm.Item name="productCode" label="商品" rules={[{ required: true }]}>
                    <MasterSelect catalog="products" />
                  </ProForm.Item>
                </Col>
                <ProFormDigit
                  name="packages"
                  label="包数"
                  colProps={{ xs: 24, md: 6 }}
                  rules={[{ required: true }]}
                  fieldProps={{ min: 1, precision: 0, step: 1 }}
                />
                <ProFormDigit
                  name="weightTonnes"
                  label="本次总重量（吨）"
                  colProps={{ xs: 24, md: 6 }}
                  rules={[{ required: true }]}
                  fieldProps={{ min: 0.0001, max: 99999999.9999, precision: 4, step: 0.0001 }}
                />
              </ProFormList>
            </ProForm.Group>
          </ProForm>
        </>
      )}
    </PageContainer>
  );
}
