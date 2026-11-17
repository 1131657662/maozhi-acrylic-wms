import { Button } from 'antd';
import { spacing } from '../../theme/design-tokens';
import { useJobs, activeJob } from './hooks/use-jobs';
import { BackupButton } from './backup-button';
import { JobsTable } from './jobs-table';
import { ArtifactsTable } from './artifacts-table';
import { RetentionPanel } from './retention-panel';
import { MaintenanceError } from './error-notice';
import { maintenanceCopy as t } from './copy';

export function BackupTab() {
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
        <JobsTable jobs={jobs?.items ?? []} loading={loadingJobs} />
      )}
      <ArtifactsTable version={version} />
      <RetentionPanel disabled={unavailable || running} />
    </div>
  );
}
