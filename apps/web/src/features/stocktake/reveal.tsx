import { useState } from 'react';
import { Alert, Button, Modal } from 'antd';
import { stocktakeCopy as copy, type PublicStocktake } from '@wms/contracts';
import { RequestError } from '../../components/RequestError';
import { useSubmitLock } from '../../components/form-protection/use-submit-lock';
import { useReveal } from './use-reveal';

export function StocktakeReveal({ take }: { take: PublicStocktake }) {
  const [open, setOpen] = useState(false);
  const incomplete = take.recordedCount !== take.lineCount;
  return (
    <>
      <Button
        type="primary"
        disabled={incomplete}
        title={incomplete ? copy.incomplete : undefined}
        onClick={() => setOpen(true)}
      >
        {copy.reveal}
      </Button>
      {open && <RevealDialog take={take} onClose={() => setOpen(false)} />}
    </>
  );
}
function RevealDialog({ take, onClose }: { take: PublicStocktake; onClose: () => void }) {
  const { mutateAsync: reveal, error } = useReveal(take.id);
  const lock = useSubmitLock();
  const confirm = () =>
    void lock
      .run(async () => {
        await reveal(take.revision);
        onClose();
      })
      .catch(() => undefined);
  return (
    <Modal
      open
      title={copy.revealTitle}
      onCancel={onClose}
      onOk={confirm}
      okText={copy.revealConfirm}
      cancelText={copy.cancel}
      confirmLoading={lock.busy}
      okButtonProps={{ disabled: lock.busy || take.recordedCount !== take.lineCount }}
      cancelButtonProps={{ disabled: lock.busy }}
      closable={!lock.busy}
      keyboard={!lock.busy}
      mask={{ closable: !lock.busy }}
    >
      <Alert type="warning" showIcon title={copy.revealDescription} />
      {error && <RequestError type="error" error={error} />}
    </Modal>
  );
}
