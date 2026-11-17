import { useRef, useState } from 'react';
import { Alert, Button, Modal, Table } from 'antd';
import { useIsMutating } from '@tanstack/react-query';
import { listTime, type BackupArtifact } from '@wms/contracts';
import { Card, SectionTitle } from '../../components/ui';
import { spacing } from '../../theme/design-tokens';
import { useRetention } from './hooks/use-retention';
import { maintenanceMutations } from './queries/maintenance-keys';
import { MaintenanceError } from './error-notice';
import { maintenanceCopy as t } from './copy';
import { bytesText } from './presentation';

export function RetentionPanel({ disabled }: { disabled: boolean }) {
  const [open, setOpen] = useState(false),
    submitting = useRef(false);
  const { mutateAsync: clean, isPending: cleaning, data: result, error: cleanError } = useRetention();
  const creating = useIsMutating({ mutationKey: maintenanceMutations.backup.mutationKey }) > 0;
  const submit = async () => {
    if (submitting.current || disabled || creating) return;
    submitting.current = true;
    try {
      await clean();
      setOpen(false);
    } catch {
      /* Keep the confirmation and safe error visible. */
    } finally {
      submitting.current = false;
    }
  };
  return (
    <Card title={<SectionTitle title={t.policy} />}>
      <div style={{ display: 'grid', gap: spacing[16] }}>
        <div>
          {t.policyDetail}
          <p>{t.manual}</p>
        </div>
        <div>
          <Button danger loading={cleaning} disabled={disabled || creating || cleaning} onClick={() => setOpen(true)}>
            {t.clean}
          </Button>
        </div>
        {result && (
          <Alert
            showIcon
            type={result.failures.length ? 'warning' : 'success'}
            title={t.cleanResult(result.deleted.length, result.retained)}
            description={
              result.failures.length ? [...new Set(result.failures.map((item) => item.reason))].join('；') : undefined
            }
          />
        )}
        {result && result.deleted.length > 0 && (
          <Table<BackupArtifact>
            rowKey="id"
            size="small"
            pagination={false}
            dataSource={result.deleted}
            caption={t.deleted}
            columns={[
              { title: t.created, dataIndex: 'createdAt', render: listTime },
              { title: t.bytes, dataIndex: 'bytes', render: bytesText },
            ]}
          />
        )}
      </div>
      <Modal
        title={t.confirmClean}
        open={open}
        onCancel={() => !cleaning && setOpen(false)}
        onOk={() => void submit()}
        confirmLoading={cleaning}
        okText={t.clean}
        cancelText={t.cancel}
        okButtonProps={{ danger: true, disabled: disabled || creating }}
        cancelButtonProps={{ disabled: cleaning }}
      >
        <p>{t.cleanDetail}</p>
        {cleanError && <MaintenanceError error={cleanError} />}
      </Modal>
    </Card>
  );
}
