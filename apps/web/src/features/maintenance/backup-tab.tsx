import { Button } from 'antd';
import { useState } from 'react';
import type { BackupArtifact } from '@wms/contracts';
import { RestoreConfirm } from './restore-confirm';
import { RestoreDetail } from './restore-detail';
import { spacing } from '../../theme/design-tokens';
import { useJobs, activeJob } from './hooks/use-jobs';
import { BackupButton } from './backup-button';
import { JobsTable } from './jobs-table';
import { ArtifactsTable } from './artifacts-table';
import { RetentionPanel } from './retention-panel';
import { MaintenanceError } from './error-notice';
import { maintenanceCopy as t } from './copy';

export function BackupTab() {
  const [restoring, setRestoring] = useState<BackupArtifact | null>(null),
    [reportId, setReportId] = useState<string | null>(null);
  const {
    data: jobs,
    error: jobsError,
    isLoading: loadingJobs,
    isFetching: fetchingJobs,
    refetch: refreshJobs,
  } = useJobs();
  const running = jobs?.items.some(activeJob) ?? false;
  const unavailable = loadingJobs || !!jobsError;
  const version = jobs?.items.find((job) => job.finishedAt)?.finishedAt ?? '';
  return (
    <div style={{ display: 'grid', gap: spacing[16] }}>
      <div style={{ display: 'flex', gap: spacing[8], alignItems: 'center', flexWrap: 'wrap' }}>
        <BackupButton disabled={unavailable} running={running} />
        <Button loading={fetchingJobs} onClick={() => void refreshJobs()}>
          {t.refresh}
        </Button>
      </div>
      {jobsError ? (
        <MaintenanceError error={jobsError} retry={refreshJobs} />
      ) : (
        <JobsTable jobs={jobs?.items ?? []} loading={loadingJobs} showReport={setReportId} />
      )}
      <ArtifactsTable version={version} restoreDisabled={unavailable || running} restore={setRestoring} />
      <RetentionPanel disabled={unavailable || running} />
      {restoring && (
        <RestoreConfirm
          key={restoring.id}
          artifact={restoring}
          close={() => setRestoring(null)}
          accepted={(id) => {
            setRestoring(null);
            setReportId(id);
          }}
        />
      )}
      {reportId && (
        <RestoreDetail
          key={reportId}
          id={reportId}
          close={() => {
            setReportId(null);
            void refreshJobs();
          }}
        />
      )}
    </div>
  );
}
