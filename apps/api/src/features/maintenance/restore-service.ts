import { restoreRequestSchema, type RestoreRequest } from '@wms/contracts';
import type { Database } from '../../db/mysql.ts';
import type { Actor } from '../../shared/audit.ts';
import { AppError } from '../../shared/errors.ts';
import { logger } from '../../shared/logger.ts';
import { auditContext } from '../audit/context.ts';
import type { MaintenanceOptions } from './options.ts';
import { withMaintenanceLock } from './lock.ts';
import { readArtifact } from './artifacts.ts';
import { insertRestore, restoreReplay } from './restore-records.ts';
import { runRestore } from './run-restore.ts';
import { failRestore, finishRestoreAccount } from './restore-finish.ts';
import { restoreText as t } from './restore-copy.ts';
import { restorePreflight } from './restore-preflight.ts';

export class RestoreService {
  private readonly workers = new Set<Promise<void>>();
  private readonly accepting = new Map<string, { artifactId: string; result: Promise<{ jobId: string }> }>();
  constructor(
    readonly db: Database,
    readonly options: MaintenanceOptions | undefined,
  ) {}
  async create(actor: Actor, key: string, request: RestoreRequest): Promise<{ jobId: string }> {
    request = restoreRequestSchema.parse(request);
    const identity = `${actor.username}:${key}`,
      pending = this.accepting.get(identity);
    if (pending) {
      if (pending.artifactId !== request.artifactId) throw new AppError('MAINTENANCE_KEY_CONFLICT', t.conflict, 409);
      return pending.result;
    }
    const result = this.accept({ actor, key, artifactId: request.artifactId });
    this.accepting.set(identity, { artifactId: request.artifactId, result });
    try {
      return await result;
    } finally {
      this.accepting.delete(identity);
    }
  }
  private async accept(input: { actor: Actor; key: string; artifactId: string }): Promise<{ jobId: string }> {
    const options = this.options;
    if (!options) throw new AppError('RESTORE_UNAVAILABLE', t.unavailable, 503);
    const previous = await restoreReplay(this.db, input);
    if (previous) return { jobId: previous };
    return new Promise((resolve, reject) => {
      const worker = auditContext
        .run(undefined, () =>
          withMaintenanceLock(this.db, async () => {
            const replay = await restoreReplay(this.db, input);
            if (replay) {
              resolve({ jobId: replay });
              return;
            }
            await restorePreflight(this.db);
            await readArtifact(this.db, input.artifactId);
            const jobId = await insertRestore(this.db, input);
            resolve({ jobId });
            await runRestore(this.db, { id: jobId, actor: input.actor, artifactId: input.artifactId, options });
          }),
        )
        .catch((error: unknown) => {
          reject(error);
          if (!(error instanceof AppError)) logger.error({ event: 'restore_worker_interrupted' }, t.interrupted);
        });
      this.workers.add(worker);
      void worker.finally(() => this.workers.delete(worker));
    });
  }
  async settled(): Promise<void> {
    await Promise.all([...this.workers]);
  }
  async recover(): Promise<void> {
    try {
      await withMaintenanceLock(this.db, async () => {
        const rows = await this.db
          .all(`SELECT r.*,j.operator,j.status FROM restore_verifications r JOIN maintenance_jobs j ON j.id=r.job_id
          WHERE j.status IN ('queued','running') OR (r.account_name IS NOT NULL AND r.account_locked=FALSE)`);
        for (const row of rows) {
          let error: unknown;
          if (row.account_name)
            try {
              await finishRestoreAccount(this.db, {
                jobId: String(row.job_id),
                source: this.options!.connection.database!,
                database: String(row.database_name),
                account: String(row.account_name),
              });
            } catch (failure) {
              error = failure;
            }
          if (row.status === 'queued' || row.status === 'running')
            await failRestore(this.db, {
              id: String(row.job_id),
              actor: { username: String(row.operator), channel: 'web', traceId: String(row.job_id) },
              error,
              interrupted: true,
            });
        }
      });
    } catch (error) {
      if (!(error instanceof AppError && error.code === 'MAINTENANCE_BUSY')) throw error;
    }
  }
}
