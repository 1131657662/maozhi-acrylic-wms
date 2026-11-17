import { Alert, Modal, Steps } from 'antd';
import { listTime, type RestoreDetail as Detail, type RestoreStage } from '@wms/contracts';
import { spacing } from '../../theme/design-tokens';
import { useRestore } from './hooks/use-restore';
import { MaintenanceError } from './error-notice';
import { RestoreReport } from './restore-report';
import { restoreCopy as t, RESTORE_UI } from './restore-copy';

const stages: RestoreStage[] = ['backup', 'provision', 'import', 'verify', 'report'];
export function RestoreDetail({ id, close }: { id: string; close: () => void }) {
  const { data: detail, error: detailError, refetch: refreshDetail } = useRestore(id);
  return (
    <Modal open title={t.report} footer={null} width={RESTORE_UI.reportWidth} onCancel={close}>
      {detailError ? (
        <MaintenanceError error={detailError} retry={refreshDetail} />
      ) : detail ? (
        <RestoreProgress detail={detail} />
      ) : (
        <p>{t.loading}</p>
      )}
    </Modal>
  );
}
function RestoreProgress({ detail }: { detail: Detail }) {
  const failed = detail.job.status === 'failed' || detail.job.status === 'interrupted';
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr)', minWidth: 0, gap: spacing[16] }}>
      <Steps
        size="small"
        current={stages.indexOf(detail.stage)}
        status={failed ? 'error' : detail.job.status === 'succeeded' ? 'finish' : 'process'}
        items={stages.map((stage) => ({ title: t.stage[stage] }))}
      />
      {detail.job.error && <Alert type="error" title={detail.job.error} />}
      {detail.databaseRetained && (
        <Alert type="info" title={t.preserved} description={detail.accountLocked ? t.locked : t.lockPending} />
      )}
      {detail.report && <RestoreReport report={detail.report} />}
      <details>
        <summary>{t.logs}</summary>
        <ol>
          {detail.evidence.map((entry, index) => (
            <li key={`${entry.at}-${index}`}>
              {listTime(entry.at)} · {t.stage[entry.stage]} · {entry.message}
            </li>
          ))}
        </ol>
      </details>
    </div>
  );
}
