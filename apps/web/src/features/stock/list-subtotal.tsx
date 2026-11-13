import { ProDescriptions } from '@ant-design/pro-components';
import { tonnes } from '@wms/contracts';
import { Card, SectionTitle } from '../../components/ui';
import { stockPageCopy } from './stock-copy';

export function StockListSubtotal({ subtotal }: { subtotal?: { packages: number; weightGrams: number } }) {
  if (!subtotal) return null;
  return (
    <section data-testid="source-stock" data-source="inventory">
      <Card title={<SectionTitle title={stockPageCopy.overviewSection} />}>
        <ProDescriptions
          title={stockPageCopy.overviewDataTitle}
          column={2}
          dataSource={subtotal}
          columns={[
            {
              title: '库存包数',
              render: (_, row) => <span data-testid="stock-subtotal-packages">{row.packages}</span>,
            },
            {
              title: '库存重量（吨）',
              render: (_, row) => <span data-testid="stock-subtotal-tonnes">{tonnes(row.weightGrams)}</span>,
            },
          ]}
        />
      </Card>
    </section>
  );
}
