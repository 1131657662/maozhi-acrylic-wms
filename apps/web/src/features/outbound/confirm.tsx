import { useState } from 'react';
import { Alert, Button, Card, Flex, Skeleton } from 'antd';
import type { Detail, ShipmentList } from '@wms/contracts';
import { Workbench } from '../scan-workbench/workbench';
import { RequestError } from '../../components/RequestError';
import { ActualLines } from './actual-lines';
import { useShipments } from './use-shipments';
import { ShipmentEntry } from './shipment-entry';
import { ShipmentMetrics } from './shipment-metrics';
import { ShipmentCloseActions } from './shipment-close-actions';
import { ShipmentRecords } from './shipment-records';
import { shipmentCopy as text } from './shipment-copy';

export function Confirm({ order }: { order: Detail }) {
  const { data: shipments, error: shipmentError, refetch: reload } = useShipments(order.id);
  const [entry, setEntry] = useState<ShipmentList | null>(null);
  if (!shipments)
    return shipmentError ? <RequestError error={shipmentError} retry={() => void reload()} /> : <Skeleton active />;
  const editable =
    ['open', 'partially_shipped'].includes(shipments.status) && ['open', 'partially_shipped'].includes(order.status);
  const stale = entry && (entry.revision !== shipments.revision || entry.digest !== shipments.digest);
  async function prefill() {
    const result = await reload();
    if (!result.data || result.error || !['open', 'partially_shipped'].includes(result.data.status)) return false;
    setEntry(result.data);
    return true;
  }
  return (
    <Flex vertical gap="middle">
      <ShipmentMetrics data={shipments} />
      {shipmentError && <RequestError error={shipmentError} retry={() => void reload()} />}
      <Card
        title={text.title}
        extra={
          <Flex gap="small" wrap>
            {!entry && <Workbench order={order} prefill={prefill} />}
            {editable && !entry && <Button onClick={() => void prefill()}>{text.prefill}</Button>}
            {editable && !entry && (
              <Button type="primary" onClick={() => setEntry(shipments)}>
                {text.start}
              </Button>
            )}
          </Flex>
        }
      >
        {stale && <Alert type="warning" title={text.stale} />}
        {entry ? (
          <ShipmentEntry id={order.id} snapshot={entry} close={() => setEntry(null)} />
        ) : (
          <ActualLines lines={shipments.lines} />
        )}
      </Card>
      {editable && !entry && <ShipmentCloseActions id={order.id} number={order.orderNo} data={shipments} />}
      <ShipmentRecords data={shipments} />
    </Flex>
  );
}
