import { useRef, useState } from 'react';
import { Alert, Descriptions, Input, Modal } from 'antd';
import { listTime, type BackupArtifact } from '@wms/contracts';
import { spacing } from '../../theme/design-tokens';
import { useCreateRestore } from './hooks/use-create-restore';
import { MaintenanceError } from './error-notice';
import { bytesText } from './presentation';
import { maintenanceCopy as m } from './copy';
import { restoreCopy as t, RESTORE_UI } from './restore-copy';

interface Props {
  artifact: BackupArtifact;
  close: () => void;
  accepted: (id: string) => void;
}
export function RestoreConfirm({ artifact, close, accepted }: Props) {
  const [confirmation, setConfirmation] = useState(''),
    submitting = useRef(false);
  const { mutateAsync: createRestore, isPending: creatingRestore, error: restoreError } = useCreateRestore();
  const submit = async () => {
    if (submitting.current || confirmation !== 'RECOVER') return;
    submitting.current = true;
    try {
      accepted((await createRestore({ artifactId: artifact.id, confirmation: 'RECOVER' })).jobId);
    } catch {
      /* The mutation error is rendered below; retain the request key. */
    } finally {
      submitting.current = false;
    }
  };
  return (
    <Modal
      open
      title={t.title}
      onCancel={close}
      onOk={() => void submit()}
      okText={t.submit}
      cancelText={t.cancel}
      confirmLoading={creatingRestore}
      okButtonProps={{ danger: true, disabled: confirmation !== 'RECOVER' }}
      cancelButtonProps={{ disabled: creatingRestore }}
      closable={!creatingRestore}
      mask={{ closable: false }}
    >
      <div style={{ display: 'grid', gap: spacing[16] }}>
        <Alert type="warning" showIcon title={t.warning} />
        <Descriptions
          column={RESTORE_UI.columns}
          items={[
            { key: 'date', label: m.created, children: listTime(artifact.createdAt) },
            { key: 'bytes', label: m.bytes, children: bytesText(artifact.bytes) },
            { key: 'check', label: m.status, children: t.checked },
          ]}
        />
        <Alert
          type={artifact.hasBaseline ? 'info' : 'warning'}
          title={artifact.hasBaseline ? t.baseline : t.noBaseline}
        />
        <label>
          {t.confirmation}
          <Input
            aria-label={t.confirmation}
            value={confirmation}
            disabled={creatingRestore}
            onChange={(event) => setConfirmation(event.target.value)}
            onPressEnter={() => void submit()}
          />
        </label>
        {restoreError && <MaintenanceError error={restoreError} />}
      </div>
    </Modal>
  );
}
