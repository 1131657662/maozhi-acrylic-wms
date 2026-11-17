import { useRef } from 'react';
import { Button } from 'antd';
import { useIsMutating } from '@tanstack/react-query';
import { CloudDownloadOutlined } from '@ant-design/icons';
import { useCreateBackup } from './hooks/use-create-backup';
import { maintenanceMutations } from './queries/maintenance-keys';
import { maintenanceCopy as t } from './copy';
import { MaintenanceError } from './error-notice';

export function BackupButton({ disabled, running }: { disabled: boolean; running: boolean }) {
  const submitting = useRef(false);
  const { mutateAsync: createBackup, isPending: isCreating, error: createError } = useCreateBackup();
  const cleaning = useIsMutating({ mutationKey: maintenanceMutations.retention.mutationKey }) > 0;
  const submit = async () => {
    if (submitting.current || disabled || running || cleaning) return;
    submitting.current = true;
    try {
      await createBackup();
    } catch {
      /* The inline error keeps the retry action visible. */
    } finally {
      submitting.current = false;
    }
  };
  return (
    <>
      <Button
        type="primary"
        aria-label={running ? t.running : isCreating ? t.creating : createError ? t.retryBackup : t.create}
        icon={<CloudDownloadOutlined aria-hidden />}
        loading={isCreating || running}
        disabled={disabled || running || cleaning || isCreating}
        onClick={() => void submit()}
      >
        {running ? t.running : isCreating ? t.creating : createError ? t.retryBackup : t.create}
      </Button>
      {createError && <MaintenanceError error={createError} />}
    </>
  );
}
