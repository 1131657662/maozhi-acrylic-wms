import { Button, Skeleton } from 'antd';
import { listTime, type MaintenanceHealth } from '@wms/contracts';
import { ApiError } from '../../api/client';
import { spacing } from '../../theme/design-tokens';
import { useHealth } from './hooks/use-health';
import { MaintenanceError } from './error-notice';
import { HealthCard } from './health-card';
import { maintenanceCopy as t } from './copy';
import { diskText, durationText, latencyText } from './presentation';

export function HealthTab() {
  const {
    data: health,
    error: healthError,
    isLoading: loadingHealth,
    isFetching: fetchingHealth,
    refetch: refreshHealth,
  } = useHealth();
  return (
    <div style={{ display: 'grid', gap: spacing[16] }}>
      <div>
        <Button loading={fetchingHealth} onClick={() => void refreshHealth()}>
          {t.refresh}
        </Button>
      </div>
      {healthError ? (
        <MaintenanceError
          error={healthError}
          retry={refreshHealth}
          title={healthError instanceof ApiError && healthError.status === 503 ? t.databaseUnavailable : t.unavailable}
        />
      ) : loadingHealth ? (
        <Skeleton active />
      ) : (
        health && <HealthChecks health={health} />
      )}
    </div>
  );
}
function HealthChecks({ health }: { health: MaintenanceHealth }) {
  const { database, disk, http, backup } = health;
  const unsupported = t.healthStatus.unsupported;
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: spacing[16] }}>
      <HealthCard
        name="database"
        title={t.database}
        check={database}
        values={[[t.latency, database.latencyMs === null ? t.dash : latencyText(database.latencyMs)]]}
      />
      <HealthCard
        name="disk"
        title={t.disk}
        check={disk}
        values={[[t.free, disk.freeBytes === null ? t.dash : diskText(disk.freeBytes)]]}
      />
      <HealthCard
        name="http"
        title={t.http}
        check={http}
        values={[
          [t.requests, http.requests === null ? unsupported : String(http.requests)],
          [t.errors, http.errors === null ? unsupported : String(http.errors)],
          [t.p95, http.p95Ms === null ? unsupported : durationText(http.p95Ms)],
        ]}
      />
      <HealthCard
        name="backup"
        title={t.recentBackup}
        check={backup}
        values={[
          [t.latestStatus, backup.latest ? t.jobStatus[backup.latest.status] : t.dash],
          [t.lastSuccess, backup.lastSuccessAt ? listTime(backup.lastSuccessAt) : t.dash],
          [t.lastFailure, backup.lastFailure ? listTime(backup.lastFailure.at) : t.noFailure],
          [t.failureReason, backup.lastFailure?.reason ?? t.dash],
          [t.schedule, backup.latestSchedule ? t.scheduleStatus[backup.latestSchedule.status] : t.noSchedule],
          [t.scheduleTime, backup.latestSchedule ? listTime(backup.latestSchedule.at) : t.dash],
          [t.scheduleReason, backup.latestSchedule?.reason ?? t.dash],
        ]}
      />
    </div>
  );
}
