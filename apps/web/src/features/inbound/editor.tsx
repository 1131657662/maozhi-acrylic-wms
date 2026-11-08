import { Alert, Button, Space } from 'antd';
import { Link, useNavigate } from '@umijs/max';
import { ProForm, ProFormDigit, ProFormList, ProFormTextArea } from '@ant-design/pro-components';
import type { CreateInbound } from '@wms/contracts';
import { tonnesToGrams } from '../../lib/weight-input';
import { MasterSelect } from '../master-data/select';
import { useCreateReceipt } from './use-create-receipt';

interface ReceiptFormValues extends Omit<CreateInbound, 'lines' | 'receiptNo'> {
  lines: { productCode?: string; packages?: number; weightTonnes?: number }[];
}

export function InboundEditor() {
  const navigate = useNavigate();
  const create = useCreateReceipt();
  async function submit(values: ReceiptFormValues): Promise<boolean> {
    try {
      const input: CreateInbound = {
        ...values,
        lines: values.lines.map((line) => ({
          productCode: line.productCode!,
          packages: line.packages!,
          weightGrams: tonnesToGrams(line.weightTonnes!),
        })),
      };
      const receipt = await create.mutateAsync(input);
      navigate(`/inbound/${receipt.id}`);
      return true;
    } catch {
      return false;
    }
  }
  return (
    <section>
      <div className="page-title">
        <div>
          <span className="eyebrow">INBOUND ENTRY</span>
          <h1>登记入库</h1>
          <p>先创建待确认单据，核对实物后明确确认才计入库存。</p>
        </div>
      </div>
      <div className="principle">
        <strong>重量独立录入</strong>
        <span>逐项填写包数和该商品本次入库总吨数；不按统一件重换算。</span>
      </div>
      {create.error && <Alert type="error" title={create.error.message} />}
      <ProForm<ReceiptFormValues>
        loading={create.isPending}
        onFinish={submit}
        submitter={{
          searchConfig: { submitText: '创建待确认入库单', resetText: '取消' },
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
        <ProForm.Item label="入库单号">
          <span>确认保存后自动生成 RK 单号</span>
        </ProForm.Item>
        <ProForm.Item name="supplierCode" label="供应商" rules={[{ required: true }]}>
          <MasterSelect catalog="suppliers" />
        </ProForm.Item>
        <ProForm.Item name="warehouseCode" label="仓库" rules={[{ required: true }]}>
          <MasterSelect catalog="warehouses" />
        </ProForm.Item>
        <ProFormTextArea name="memo" label="备注" fieldProps={{ maxLength: 500, rows: 2 }} />
        <ProFormList
          name="lines"
          label="商品明细"
          initialValue={[{}]}
          min={1}
          creatorButtonProps={{ creatorButtonText: '添加商品' }}
        >
          <ProForm.Item name="productCode" label="商品" rules={[{ required: true }]}>
            <MasterSelect catalog="products" />
          </ProForm.Item>
          <ProFormDigit
            name="packages"
            label="包数"
            rules={[{ required: true }]}
            fieldProps={{ min: 1, precision: 0, step: 1 }}
          />
          <ProFormDigit
            name="weightTonnes"
            label="本次总重量（吨）"
            rules={[{ required: true }]}
            fieldProps={{ min: 0.0001, max: 99999999.9999, precision: 4, step: 0.0001 }}
          />
        </ProFormList>
      </ProForm>
    </section>
  );
}
