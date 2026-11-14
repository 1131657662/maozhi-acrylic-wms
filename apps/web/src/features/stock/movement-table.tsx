import { Table, theme } from 'antd';
import type { TableProps } from 'antd';
import { tonnes, type StockMovement } from '@wms/contracts';
import { JournalTypeTag } from '../../components/JournalTypeTag';
import { EmptyState } from '../../components/ui';
import { formatTime } from '../../lib/format-time';
import { JournalDetail } from './journal-detail';
import { movementCopy as copy } from './movement-copy';

export function MovementTable(props: {
  rows: StockMovement[];
  loading: boolean;
  pagination: TableProps<StockMovement>['pagination'];
  targetId?: string;
  compact?: boolean;
}) {
  const { token } = theme.useToken();
  return (
    <Table<StockMovement>
      rowKey="id"
      data-testid="stock-movement-table"
      dataSource={props.rows}
      loading={props.loading}
      pagination={props.pagination}
      size="middle"
      scroll={props.compact ? undefined : { x: 'max-content' }}
      onRow={(row) => (row.id === props.targetId ? { style: { background: token.colorPrimaryBg } } : {})}
      locale={{ emptyText: <EmptyState description={copy.empty} /> }}
      columns={[
        { title: copy.time, render: (_, row) => formatTime(row.createdAt) },
        { title: copy.type, render: (_, row) => <JournalTypeTag type={row.type} /> },
        ...(!props.compact
          ? [
              { title: copy.product, render: (_: unknown, row: StockMovement) => row.productName ?? row.productCode },
              {
                title: copy.warehouse,
                render: (_: unknown, row: StockMovement) => row.warehouseName ?? row.warehouseCode,
              },
            ]
          : []),
        { title: copy.packages, dataIndex: 'packagesDelta', align: 'right' },
        { title: copy.weight, render: (_, row) => tonnes(row.weightDeltaGrams), align: 'right' },
        { title: copy.evidence, render: (_, row) => <JournalDetail row={row} /> },
      ]}
    />
  );
}
