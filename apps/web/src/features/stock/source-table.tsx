import { Alert } from 'antd';
import { ProDescriptions, ProTable, type ProColumns, type ProDescriptionsProps } from '@ant-design/pro-components';
import { tonnes, type SourceStock, type SourceStockRow } from '@wms/contracts';
import { sourceLabels } from './source-labels';

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

function SourceSubtotal({ data }: { data: SourceStock }) {
  if (data.source === 'unclassified')
    return (
      <Alert
        type="warning"
        showIcon
        title="这些商品尚未归属 ERP 或 SPEC，暂不计算小计"
        description="保留库存明细和原始来源；不要根据商品编码或名称自行合并。"
      />
    );
  if (!data.subtotal) return null;
  return (
    <ProDescriptions
      title={`${sourceLabels[data.source]} · 本来源小计`}
      column={2}
      dataSource={data.subtotal}
      columns={subtotalColumns}
    />
  );
}

export function SourceStockTable({ data }: { data: SourceStock }) {
  const columns =
    data.source === 'unclassified'
      ? [
          ...stockColumns,
          {
            title: '原始来源',
            dataIndex: 'sourceKind',
            renderText: (value: string | null) => value ?? '主数据缺失',
          },
        ]
      : stockColumns;
  return (
    <section data-testid="source-stock" data-source={data.source}>
      <SourceSubtotal data={data} />
      <ProTable<SourceStockRow>
        rowKey={(row) => `${row.warehouseCode}/${row.productCode}`}
        dataSource={data.items}
        headerTitle={`${sourceLabels[data.source]} · 库存明细`}
        search={false}
        options={false}
        pagination={false}
        locale={{ emptyText: '本来源暂无已确认库存；条码目录重量不等于库存' }}
        columns={columns}
      />
    </section>
  );
}
