import { useState } from 'react';
import { Button, Card, Flex, Tooltip, Typography } from 'antd';
import type { ShipmentList } from '@wms/contracts';
import { useLockedConfirm } from '../../components/form-protection/use-locked-confirm';
import { RequestError } from '../../components/RequestError';
import { useCompleteShipment } from './use-complete-shipment';
import { ShortCloseDialog } from './short-close-dialog';
import { shipmentCopy as text } from './shipment-copy';

export function ShipmentCloseActions({ id, number, data }: { id: string; number: string; data: ShipmentList }) {
  const [shortSnapshot, setShortSnapshot] = useState<ShipmentList | null>(null);
  const modal = useLockedConfirm();
  const { mutateAsync: complete, error: completeError } = useCompleteShipment(id);
  const hasRemaining = data.remainingPackages !== 0 || data.remainingWeightGrams !== 0;
  if (data.status !== 'partially_shipped' && data.status !== 'open') return null;
  function askComplete() {
    modal.confirm({
      title: `${text.completeTitle} · ${number}`,
      content: text.completeHint,
      okText: text.complete,
      cancelText: text.cancel,
      onOk: () => complete(data),
    });
  }
  return (
    <Card size="small">
      <Flex vertical gap="small">
        <Tooltip title={hasRemaining ? text.pendingHint : undefined}>
          <span>
            <Button disabled={hasRemaining || modal.busy || !!shortSnapshot} onClick={askComplete}>
              {text.complete}
            </Button>
          </span>
        </Tooltip>
        {hasRemaining && <Typography.Text type="secondary">{text.pendingHint}</Typography.Text>}
        {data.status === 'partially_shipped' && (
          <div>
            <Button danger disabled={modal.busy} onClick={() => setShortSnapshot(data)}>
              {text.short}
            </Button>
          </div>
        )}
        {completeError && <RequestError error={completeError} />}
      </Flex>
      {shortSnapshot && (
        <ShortCloseDialog id={id} number={number} snapshot={shortSnapshot} close={() => setShortSnapshot(null)} />
      )}
    </Card>
  );
}
