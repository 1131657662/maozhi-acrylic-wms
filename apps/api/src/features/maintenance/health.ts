import { MAINTENANCE, type MaintenanceHealth, type MaintenanceCheck } from '@wms/contracts';
import type { Database } from '../../db/mysql.ts';
import { BackupFiles } from './files.ts';
import { backupHealth } from './backup-health.ts';
import type { MaintenanceOptions } from './options.ts';
import { maintenanceHealthText as t } from './copy.ts';

function check(source: string, status: MaintenanceCheck['status'], reason: string | null = null): MaintenanceCheck {
  return { source, status, reason, checkedAt: new Date().toISOString() };
}
async function databaseHealth(db: Database): Promise<MaintenanceHealth['database']> {
  const start = performance.now();
  try {
    await db.ping();
    return { ...check(t.databaseSource, 'ok'), latencyMs: performance.now() - start };
  } catch {
    return { ...check(t.databaseSource, 'error', t.databaseFailed), latencyMs: null };
  }
}
async function diskHealth(options?: MaintenanceOptions): Promise<MaintenanceHealth['disk']> {
  if (!options) return { ...check(t.diskSource, 'unsupported', t.diskMissing), freeBytes: null };
  try {
    const freeBytes = await new BackupFiles(options.directory).freeBytes();
    return {
      ...check(
        t.diskSource,
        freeBytes < MAINTENANCE.minFreeBytes ? 'error' : 'ok',
        freeBytes < MAINTENANCE.minFreeBytes ? t.diskLow : null,
      ),
      freeBytes,
    };
  } catch {
    return { ...check(t.diskSource, 'error', t.diskFailed), freeBytes: null };
  }
}
export async function maintenanceHealth(db: Database, options?: MaintenanceOptions): Promise<MaintenanceHealth> {
  const [database, disk, backup] = await Promise.all([databaseHealth(db), diskHealth(options), backupHealth(db)]);
  return {
    database,
    disk,
    backup,
    http: {
      ...check(t.httpSource, 'unsupported', t.httpUnsupported),
      windowHours: 24,
      requests: null,
      errors: null,
      p95Ms: null,
    },
  };
}
