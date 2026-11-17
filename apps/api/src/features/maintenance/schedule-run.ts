import { randomUUID } from 'node:crypto';
import type { MaintenanceService } from './service.ts';
import { AppError } from '../../shared/errors.ts';
import { sqlDate } from '../../db/dates.ts';
import { schedulerText as t } from './copy.ts';

export interface ScheduleAttempt {
  now: Date;
  day: string;
  daily: boolean;
  startup: boolean;
}
export async function runScheduledBackup(service: MaintenanceService, input: ScheduleAttempt): Promise<void> {
  const id = randomUUID(),
    detail = {
      day: input.day,
      daily: input.daily,
      trigger: input.startup ? 'startup' : 'daily',
      reason: input.startup ? t.startup : t.daily,
    };
  await service.db.run("INSERT INTO scheduler_runs(id,kind,ran_at,status,detail) VALUES(?,'backup',?,'running',?)", [
    id,
    sqlDate(input.now.toISOString()),
    JSON.stringify(detail),
  ]);
  try {
    const { jobId } = await service.create({ username: 'owner', channel: 'web', traceId: id }, id);
    await service.db.run('UPDATE maintenance_jobs SET params=? WHERE id=?', [
      JSON.stringify({ schedulerRunId: id, trigger: detail.trigger }),
      jobId,
    ]);
    await service.settled();
    const job = await service.db.get('SELECT status,error FROM maintenance_jobs WHERE id=?', [jobId]);
    const status = job?.status === 'succeeded' ? 'succeeded' : job?.status === 'interrupted' ? 'interrupted' : 'failed';
    await service.db.run('UPDATE scheduler_runs SET status=?,detail=? WHERE id=?', [
      status,
      JSON.stringify({ ...detail, jobId, reason: job?.error ?? (status === 'succeeded' ? null : t.failed) }),
      id,
    ]);
  } catch (error) {
    const busy = error instanceof AppError && error.code === 'MAINTENANCE_BUSY';
    await service.db.run('UPDATE scheduler_runs SET status=?,detail=? WHERE id=?', [
      busy ? 'skipped' : 'failed',
      JSON.stringify({ ...detail, reason: busy ? t.busy : t.failed }),
      id,
    ]);
  }
}
