import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Alert, Button, Modal } from 'antd';
import { discoveryCopy as t, tonnes, type PublicStocktakeLine } from '@wms/contracts';
import { useDiscovery } from './use-discovery';
import { stocktakeKeys } from './keys';

export function DiscoveryDelete({ id, line }: { id: string; line: PublicStocktakeLine }) {
  const [open, setOpen] = useState(false);
  const mutation = useDiscovery(id),
    client = useQueryClient();
  async function remove() {
    if (!line.discovery || mutation.isPending) return;
    try {
      await mutation.mutateAsync({
        method: 'DELETE',
        lineId: line.discovery.id,
        input: { version: line.discovery.version },
      });
      setOpen(false);
    } catch {
      /* Keep confirmation and retry key for a failed response. */
    }
  }
  return (
    <>
      <Button type="link" danger onClick={() => setOpen(true)}>
        {t.remove}
      </Button>
      <Modal
        open={open}
        title={t.confirmDelete}
        okText={t.confirm}
        cancelText={t.cancel}
        okButtonProps={{ danger: true }}
        confirmLoading={mutation.isPending}
        keyboard={!mutation.isPending}
        mask={{ closable: false }}
        onCancel={mutation.isPending ? undefined : () => setOpen(false)}
        onOk={() => void remove()}
      >
        <p>
          {line.productName} · {line.productCode}：{line.actual?.packages} 包 / {tonnes(line.actual?.weightGrams ?? 0)}{' '}
          吨
        </p>
        <p>{t.deleteDescription}</p>
        {mutation.error && (
          <Alert
            type="error"
            title={mutation.error.message}
            action={
              <Button onClick={() => void client.invalidateQueries({ queryKey: stocktakeKeys._def })}>
                {t.refresh}
              </Button>
            }
          />
        )}
      </Modal>
    </>
  );
}
