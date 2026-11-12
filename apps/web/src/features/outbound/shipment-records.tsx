import { Button, Card, Descriptions, Table, Tooltip } from 'antd';
import type { ShipmentList } from '@wms/contracts';
import { formatTime } from '../../lib/format-time';
import { shipmentCopy as text, SHIPMENT_UI as ui } from './shipment-copy';

export function ShipmentRecords({ data }: { data: ShipmentList }) {
  return (
    <Card
      title={text.records}
      extra={
        <Tooltip title={text.printUnavailable}>
          <span>
            <Button disabled>{text.print}</Button>
          </span>
        </Tooltip>
      }
    >
      <Table
        rowKey="id"
        dataSource={data.items}
        pagination={false}
        scroll={{ x: ui.recordWidth }}
        locale={{ emptyText: text.recordEmpty }}
        data-testid="shipment-records"
        columns={[
          { title: text.sequence, dataIndex: 'seq', render: (seq: number) => text.batch(seq) },
          { title: text.vehicle, dataIndex: 'vehicleNo' },
          { title: text.date, dataIndex: 'shippedAt', render: (date: string) => formatTime(date) },
          { title: text.original, align: 'right', render: (_, row) => text.quantity(row.packages, row.weightGrams) },
          {
            title: text.effective,
            align: 'right',
            render: (_, row) => text.quantity(row.effectivePackages, row.effectiveWeightGrams),
          },
          { title: text.operator, dataIndex: 'operator' },
        ]}
      />
      <ClosureEvidence data={data} />
    </Card>
  );
}
function ClosureEvidence({ data }: { data: ShipmentList }) {
  const closed = data.shortClosure;
  return (
    <Descriptions
      column={1}
      items={[
        ...(data.completedAt
          ? [{ key: 'completed', label: text.completeTime, children: formatTime(data.completedAt) }]
          : []),
        ...(closed
          ? [
              { key: 'reason', label: text.shortReason, children: closed.reason },
              { key: 'closed', label: text.closedTime, children: formatTime(closed.at) },
              {
                key: 'remaining',
                label: text.closedAmount,
                children: text.quantity(closed.packages, closed.weightGrams),
              },
            ]
          : []),
      ]}
    />
  );
}
