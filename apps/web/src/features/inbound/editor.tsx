import { Alert, Button, Space } from 'antd';
import { Link, useNavigate } from '@umijs/max';
import {
  ProForm,
  ProFormDigit,
  ProFormList,
  ProFormSelect,
  ProFormText,
  ProFormTextArea,
} from '@ant-design/pro-components';
import type { CreateInbound } from '@wms/contracts';
import { tonnesToGrams } from '../../lib/weight-input';
import { useMasterItems } from '../master-data/use-master-items';
import { useCreateReceipt } from './use-create-receipt';

interface ReceiptFormValues extends Omit<CreateInbound, 'lines'> {
  lines: { productCode?: string; packages?: number; weightTonnes?: number }[];
}

function options(items: { code: string; name: string; active: boolean }[] | undefined) {
  return (items ?? [])
    .filter((item) => item.active)
    .map((item) => ({ value: item.code, label: `${item.code} · ${item.name}` }));
}

export function InboundEditor() {
  const navigate = useNavigate();
  const suppliers = useMasterItems('suppliers');
  const warehouses = useMasterItems('warehouses');
  const products = useMasterItems('products');
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
    } catch (error) {
      return Promise.reject(error);
    }
  }
  const loading = suppliers.isLoading || warehouses.isLoading || products.isLoading;
  const loadError = suppliers.error ?? warehouses.error ?? products.error;
  return (
    <section>
      <div className="page-title">
        <div>
          <span className="eyebrow">INBOUND ENTRY</span>
          <h1>登记入库</h1>
          <p>保存后立即增加库存，并写入库存流水和操作记录。</p>
        </div>
      </div>
      <div className="principle">
        <strong>重量独立录入</strong>
        <span>逐项填写包数和该商品本次入库总吨数；不按统一件重换算。</span>
      </div>
      {loadError && <Alert type="error" title={loadError.message} />}
      {create.error && <Alert type="error" title={create.error.message} />}
      <ProForm<ReceiptFormValues>
        onFinish={submit}
        submitter={{
          searchConfig: { submitText: '确认入库', resetText: '取消' },
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
        <ProFormText name="receiptNo" label="入库单号" rules={[{ required: true }]} fieldProps={{ maxLength: 100 }} />
        <ProFormSelect
          name="supplierCode"
          label="供应商"
          rules={[{ required: true }]}
          options={options(suppliers.data)}
          showSearch
          fieldProps={{ loading }}
        />
        <ProFormSelect
          name="warehouseCode"
          label="仓库"
          rules={[{ required: true }]}
          options={options(warehouses.data)}
          showSearch
          fieldProps={{ loading }}
        />
        <ProFormTextArea name="memo" label="备注" fieldProps={{ maxLength: 500, rows: 2 }} />
        <ProFormList
          name="lines"
          label="商品明细"
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
