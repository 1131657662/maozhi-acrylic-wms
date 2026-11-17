import type { Database } from '../../db/mysql.ts';
import type { Actor } from '../../shared/audit.ts';
import { AppError } from '../../shared/errors.ts';
import { logger } from '../../shared/logger.ts';
import { auditContext } from '../audit/context.ts';
import { withMaintenanceLock } from './lock.ts';
import { existingBackup, insertBackup, interruptBackups } from './jobs.ts';
import { runBackup } from './run-backup.ts';
import type { MaintenanceOptions } from './options.ts';
import { maintenanceErrors as copy } from './copy.ts';
import { RestoreService } from './restore-service.ts';

export class MaintenanceService {
  readonly restores: RestoreService;
  private readonly running = new Set<Promise<void>>();
  private readonly accepting = new Map<string, Promise<{ jobId: string }>>();
  constructor(
    readonly db: Database,
    readonly options: MaintenanceOptions | undefined,
  ) {
    this.restores = new RestoreService(db, options);
  }
  async recover(): Promise<void> {
    await this.restores.recover();
    try {
      await withMaintenanceLock(this.db, () => interruptBackups(this.db));
    } catch (error) {
      if (!(error instanceof AppError && error.code === 'MAINTENANCE_BUSY')) throw error;
    }
  }
  async create(actor: Actor, operationId: string): Promise<{ jobId: string }> {
    const key = `${actor.username}:${operationId}`;
    const pending = this.accepting.get(key);
    if (pending) return pending;
    const accepted = this.accept(actor, operationId);
    this.accepting.set(key, accepted);
    try {
      return await accepted;
    } finally {
      if (this.accepting.get(key) === accepted) this.accepting.delete(key);
    }
  }
  private async accept(actor: Actor, operationId: string): Promise<{ jobId: string }> {
    if (!this.options) throw new AppError('BACKUP_UNAVAILABLE', copy.unavailable, 503);
    const previous = await existingBackup(this.db, actor, operationId);
    if (previous) return { jobId: previous };
    const options = this.options;
    return new Promise<{ jobId: string }>((resolve, reject) => {
      const worker = auditContext
        .run(undefined, () =>
          withMaintenanceLock(this.db, async () => {
            const replay = await existingBackup(this.db, actor, operationId);
            if (replay) {
              resolve({ jobId: replay });
              return;
            }
            await interruptBackups(this.db, false);
            const jobId = await insertBackup(this.db, actor, operationId);
            resolve({ jobId });
            await runBackup(this.db, { id: jobId, actor, options });
          }),
        )
        .catch((error: unknown) => {
          reject(error);
          if (!(error instanceof AppError)) logger.error({ event: 'maintenance_worker_interrupted' }, copy.interrupted);
        });
      this.running.add(worker);
      void worker.finally(() => this.running.delete(worker));
    });
  }
  async settled(): Promise<void> {
    await Promise.all([...this.running, this.restores.settled()]);
  }
}
