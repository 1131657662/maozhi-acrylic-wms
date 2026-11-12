import { useState } from 'react';
import { Button, Flex } from 'antd';
import type { Detail } from '@wms/contracts';
import { useLockedConfirm } from '../../components/form-protection/use-locked-confirm';
import { useScanExport } from '../outbound/use-scan-export';
import { RequestError } from '../../components/RequestError';
import type { CountingCommand } from './use-counting-command';
import { text } from './copy';

export function CountingFooter({
  order,
  command,
  prefill,
  close,
}: {
  order: Detail;
  command: CountingCommand;
  prefill: () => Promise<boolean>;
  close: () => void;
}) {
  const modal = useLockedConfirm();
  const download = useScanExport(order.id, order.orderNo);
  const [prefilling, setPrefilling] = useState(false);
  const editable = order.status === 'open';
  const latest = [...order.facts].sort(
    (a, b) => b.receivedAt.localeCompare(a.receivedAt) || b.id.localeCompare(a.id),
  )[0];
  async function fill() {
    setPrefilling(true);
    try {
      if (await prefill()) close();
    } finally {
      setPrefilling(false);
    }
  }
  function undo() {
    if (!latest) return;
    modal.confirm({
      title: text.undoTitle,
      content: (
        <>
          <p>{latest.barcode}</p>
          <p>{text.undoNotice}</p>
        </>
      ),
      okText: text.confirm,
      cancelText: text.cancel,
      onOk: async () => {
        await command.run({ kind: 'revoke', recordId: latest.id });
      },
    });
  }
  return (
    <>
      {download.error && <RequestError error={download.error} />}
      <Flex gap="small" wrap>
        <Button
          type="primary"
          disabled={!editable || command.busy || prefilling}
          loading={prefilling}
          onClick={() => void fill()}
        >
          {text.prefill}
        </Button>
        <Button loading={download.isPending} disabled={download.isPending} onClick={() => download.mutate()}>
          {text.export}
        </Button>
        <Button danger disabled={!editable || !latest || command.busy || modal.busy} onClick={undo}>
          {text.undo}
        </Button>
        <Button onClick={close}>{text.close}</Button>
      </Flex>
    </>
  );
}
