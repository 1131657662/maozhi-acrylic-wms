import { ProForm, ProFormDigit, ProFormList } from '@ant-design/pro-components';
import { tonnes, type Detail } from '@wms/contracts';
import { PartyFields } from '../master-data/party-fields';
import { MasterSelect } from '../master-data/select';

export function PlanLinesFields() {
  return (
    <>
      <PartyFields partyType="customer" />
      <ProForm.Item name="warehouseCode" label="仓库" rules={[{ required: true }]}>
        <MasterSelect catalog="warehouses" />
      </ProForm.Item>
      <ProFormList
        name="lines"
        label="计划明细"
        initialValue={[{}]}
        min={1}
        max={50}
        creatorButtonProps={{ creatorButtonText: '添加商品' }}
      >
        <ProForm.Item name="productCode" label="商品" rules={[{ required: true }]}>
          <MasterSelect catalog="products" />
        </ProForm.Item>
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
          fieldProps={{ min: 0.0001, max: 1000, precision: 4, step: 0.0001 }}
        />
      </ProFormList>
    </>
  );
}

export function PlanReadOnlyLines({ order }: { order: Detail }) {
  return (
    <div className="line-summary">
      <p>
        客户：{order.customerCode} · {order.customerName}；仓库：{order.warehouseCode}
      </p>
      {order.lines.map((line) => (
        <p key={line.id}>
          {line.productCode} · {line.productName} — 计划 {line.plannedPackages} 包 / {tonnes(line.plannedWeightGrams)}{' '}
          吨
        </p>
      ))}
    </div>
  );
}
