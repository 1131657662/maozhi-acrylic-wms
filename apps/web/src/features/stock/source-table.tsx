import { ProDescriptions, ProTable, type ProColumns, type ProDescriptionsProps } from '@ant-design/pro-components';
import { tonnes, type SourceStock, type SourceStockRow } from '@wms/contracts';
import { Button } from 'antd';
import { useState } from 'react';
import { AdjustmentDrawer } from './adjustment-drawer';

type ErpStock = Extract<SourceStock, { source: 'erp-product' }>;

const stockColumns: ProColumns<SourceStockRow>[] = [
  { title: '仓库', dataIndex: 'warehouseCode' },
  { title: '商品编码', dataIndex: 'productCode' },
  { title: '商品名称', dataIndex: 'productName', renderText: (name) => name ?? '未关联主数据' },
  { title: '库存包数', render: (_, row) => <span data-testid="stock-row-packages">{row.packages}</span> },
  {
    title: '库存重量（吨）',
    render: (_, row) => <span data-testid="stock-row-tonnes">{tonnes(row.weightGrams)}</span>,
  },
];
const subtotalColumns: ProDescriptionsProps<NonNullable<SourceStock['subtotal']>>['columns'] = [
  {
    title: '库存包数',
    render: (_, row) => (
      <>
        <span data-testid="stock-subtotal-packages">{row.packages}</span> 包
      </>
    ),
  },
  {
    title: '库存重量',
    render: (_, row) => (
      <>
        <span data-testid="stock-subtotal-tonnes">{tonnes(row.weightGrams)}</span> 吨
      </>
    ),
  },
];

function SourceSubtotal({ data }: { data: ErpStock }) {
  if (!data.subtotal) return null;
  return (
    <ProDescriptions title="ERP 商品 · 库存汇总" column={2} dataSource={data.subtotal} columns={subtotalColumns} />
  );
}

export function SourceStockTable({ data }: { data: ErpStock }) {
  const [selected, setSelected] = useState<SourceStockRow | null>(null);
  return (
    <section data-testid="source-stock" data-source={data.source}>
      <SourceSubtotal data={data} />
      <ProTable<SourceStockRow>
        rowKey={(row) => `${row.warehouseCode}/${row.productCode}`}
        dataSource={data.items}
        headerTitle="ERP 商品 · 库存明细"
        search={false}
        options={false}
        pagination={false}
        locale={{ emptyText: '暂无 ERP 商品库存；请核对入库单据' }}
        columns={[
          ...stockColumns,
          {
            title: '操作',
            valueType: 'option',
            render: (_, row) => (
              <Button type="link" onClick={() => setSelected(row)}>
                调整库存
              </Button>
            ),
          },
        ]}
      />
      {selected && <AdjustmentDrawer row={selected} onClose={() => setSelected(null)} />}
    </section>
  );
}
