import { maintenanceScheduleSchema, type MaintenanceHealth } from '@wms/contracts';
import type { Database } from '../../db/mysql.ts';
import { isoDate } from '../../db/dates.ts';
import { listMaintenanceJobs } from './jobs.ts';
import { maintenanceHealthText as t } from './copy.ts';

async function history(db: Database) {
  const success = await db.get(
    "SELECT MAX(finished_at) AS at FROM maintenance_jobs WHERE kind='backup' AND status='succeeded'",
  );
  const failure = await db.get(
    "SELECT COALESCE(finished_at,started_at) AS at,error FROM maintenance_jobs WHERE kind='backup' AND status IN ('failed','interrupted') ORDER BY started_at DESC,id DESC LIMIT 1",
  );
  const schedule = await db.get(
    "SELECT ran_at,status,JSON_UNQUOTE(JSON_EXTRACT(detail,'$.reason')) AS reason FROM scheduler_runs WHERE kind='backup' ORDER BY ran_at DESC,id DESC LIMIT 1",
  );
  const scheduleFailure = await db.get(
    "SELECT ran_at AS at,JSON_UNQUOTE(JSON_EXTRACT(detail,'$.reason')) AS error FROM scheduler_runs WHERE kind='backup' AND status IN ('failed','interrupted') ORDER BY ran_at DESC,id DESC LIMIT 1",
  );
  const latestFailure = [failure, scheduleFailure]
    .filter((row) => row?.at)
    .sort((a, b) => isoDate(b!.at).localeCompare(isoDate(a!.at)))[0];
  return {
    lastSuccessAt: success?.at ? isoDate(success.at) : null,
    lastFailure: latestFailure
      ? { at: isoDate(latestFailure.at), reason: String(latestFailure.error ?? t.scheduleFailed) }
      : null,
    latestSchedule: schedule
      ? maintenanceScheduleSchema.parse({
          at: isoDate(schedule.ran_at),
          status: schedule.status,
          reason:
            schedule.status === 'interrupted'
              ? t.scheduleInterrupted
              : schedule.reason === 'null'
                ? null
                : schedule.reason,
        })
      : null,
  };
}
export async function backupHealth(db: Database): Promise<MaintenanceHealth['backup']> {
  const base = { source: t.backupSource, checkedAt: new Date().toISOString() };
  try {
    const [latest = null] = await listMaintenanceJobs(db, { kind: 'backup', limit: 1 });
    const records = await history(db);
    const scheduleFailed = records.latestSchedule && ['failed', 'interrupted'].includes(records.latestSchedule.status);
    const status =
      scheduleFailed || !latest
        ? 'error'
        : latest.status === 'succeeded'
          ? 'ok'
          : ['queued', 'running'].includes(latest.status)
            ? 'pending'
            : 'error';
    return {
      ...base,
      ...records,
      status,
      reason: scheduleFailed ? t.scheduleFailed : (latest?.error ?? (latest ? null : t.backupEmpty)),
      latest,
    };
  } catch {
    return {
      ...base,
      status: 'error',
      reason: t.backupFailed,
      latest: null,
      lastSuccessAt: null,
      lastFailure: null,
      latestSchedule: null,
    };
  }
}
