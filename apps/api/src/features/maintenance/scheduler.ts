import { MAINTENANCE } from '@wms/contracts';
import { isoDate } from '../../db/dates.ts';
import { logger } from '../../shared/logger.ts';
import { MaintenanceService } from './service.ts';
import { scheduleDay, startupOverdue } from './schedule-plan.ts';
import { runScheduledBackup } from './schedule-run.ts';

export class MaintenanceScheduler {
  private pending: Promise<void> | undefined;
  private timer: ReturnType<typeof setInterval> | undefined;
  private startupPending = false;
  constructor(
    private readonly service: MaintenanceService,
    private readonly clock = () => new Date(),
  ) {}
  check(startup = false): Promise<void> {
    if (startup) this.startupPending = true;
    if (this.pending) return this.pending;
    const pending = this.checkDue(this.startupPending)
      .then(() => {
        this.startupPending = false;
      })
      .catch(() => {
        logger.error({ event: 'maintenance_schedule_unavailable' }, '自动备份调度未完成，数据库恢复后重试');
      })
      .finally(() => {
        if (this.pending === pending) this.pending = undefined;
      });
    this.pending = pending;
    return pending;
  }
  start(): void {
    if (this.timer) return;
    void this.check(true);
    this.timer = setInterval(() => void this.check(), MAINTENANCE.schedulerIntervalMs);
    this.timer.unref();
  }
  async stop(): Promise<void> {
    if (this.timer) clearInterval(this.timer);
    this.timer = undefined;
    await this.pending;
  }
  private async checkDue(startup: boolean): Promise<void> {
    const now = this.clock(),
      { day, due } = scheduleDay(now);
    const last = await this.service.db.get(
      "SELECT MAX(finished_at) AS at FROM maintenance_jobs WHERE kind='backup' AND status='succeeded'",
    );
    const compensate = startup && startupOverdue(last?.at ? isoDate(last.at) : null, now);
    const attempted = await this.service.db.get(
      `SELECT id FROM scheduler_runs WHERE kind='backup'
      AND JSON_UNQUOTE(JSON_EXTRACT(detail,'$.day'))=? AND JSON_EXTRACT(detail,'$.daily')=true LIMIT 1`,
      [day],
    );
    if (!compensate && (!due || attempted)) return;
    await runScheduledBackup(this.service, { now, day, daily: due, startup: compensate });
  }
}
