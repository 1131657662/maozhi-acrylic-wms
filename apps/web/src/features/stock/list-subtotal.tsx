import { ProDescriptions } from '@ant-design/pro-components';
import { tonnes } from '@wms/contracts';

export function StockListSubtotal({ subtotal }: { subtotal?: { packages: number; weightGrams: number } }) {
  if (!subtotal) return null;
  return (
    <section data-testid="source-stock" data-source="erp-product">
      <ProDescriptions
        title="ERP 商品 · 当前筛选范围汇总（含全部分页）"
        column={2}
        dataSource={subtotal}
        columns={[
          { title: '库存包数', render: (_, row) => <span data-testid="stock-subtotal-packages">{row.packages}</span> },
          {
            title: '库存重量（吨）',
            render: (_, row) => <span data-testid="stock-subtotal-tonnes">{tonnes(row.weightGrams)}</span>,
          },
        ]}
      />
    </section>
  );
}
