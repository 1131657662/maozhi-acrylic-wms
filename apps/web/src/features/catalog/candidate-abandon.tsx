import { useState } from 'react';
import { Alert, Button, Input, Modal, Space } from 'antd';
import { CATALOG_ABANDON_REASON_MAX } from '@wms/contracts';
import { RequestError } from '../../components/RequestError';
import { useSubmitLock } from '../../components/form-protection/use-submit-lock';
import { spacing } from '../../theme/design-tokens';
import { useAbandon } from './use-abandon';
import { candidateCopy as copy } from './candidate-copy';

export function CandidateAbandon({ versionId }: { versionId: number }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button danger onClick={() => setOpen(true)}>
        {copy.abandon}
      </Button>
      {open && <AbandonDialog versionId={versionId} onClose={() => setOpen(false)} />}
    </>
  );
}
function AbandonDialog({ versionId, onClose }: { versionId: number; onClose: () => void }) {
  const [reason, setReason] = useState('');
  const { mutateAsync: abandon, error: abandonError } = useAbandon(versionId);
  const lock = useSubmitLock();
  const confirm = () =>
    void lock
      .run(async () => {
        await abandon(reason.trim());
        onClose();
      })
      .catch(() => undefined);
  return (
    <Modal
      open
      title={copy.abandonTitle}
      onCancel={onClose}
      onOk={confirm}
      okText={copy.confirmAbandon}
      cancelText={copy.cancel}
      confirmLoading={lock.busy}
      okButtonProps={{ danger: true, disabled: !reason.trim() || lock.busy }}
      cancelButtonProps={{ disabled: lock.busy }}
      closable={!lock.busy}
      keyboard={!lock.busy}
      mask={{ closable: !lock.busy }}
    >
      <Space orientation="vertical" size={spacing[16]} style={{ width: '100%' }}>
        <Alert type="warning" title={copy.abandonHint} />
        <label htmlFor="catalog-abandon-reason">{copy.reason}</label>
        <Input.TextArea
          id="catalog-abandon-reason"
          value={reason}
          disabled={lock.busy}
          maxLength={CATALOG_ABANDON_REASON_MAX}
          showCount
          onChange={(event) => setReason(event.target.value)}
        />
        {abandonError && <RequestError type="error" error={abandonError} />}
      </Space>
    </Modal>
  );
}
