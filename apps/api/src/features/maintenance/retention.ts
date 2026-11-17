import { randomUUID } from 'node:crypto';
import type { RetentionResult } from '@wms/contracts';
import type { Database } from '../../db/mysql.ts';
import type { Actor } from '../../shared/audit.ts';
import { AppError } from '../../shared/errors.ts';
import { activeArtifacts, projectArtifact } from './artifacts.ts';
import { retentionPlan } from './retention-policy.ts';
import { withMaintenanceLock } from './lock.ts';
import { BackupFiles } from './files.ts';
import { expireArtifact } from './expire-artifact.ts';
import { maintenanceErrors as copy } from './copy.ts';

export async function retainBackups(db: Database, files: BackupFiles, actor: Actor): Promise<RetentionResult> {
  return withMaintenanceLock(db, async () => {
    const id = randomUUID();
    await db.run("INSERT INTO scheduler_runs VALUES(?,'retention',UTC_TIMESTAMP(3),'running',?)", [
      id,
      JSON.stringify({ operator: actor.username }),
    ]);
    try {
      const result = await cleanArtifacts(db, files, actor);
      await db.run('UPDATE scheduler_runs SET status=?,detail=? WHERE id=?', [
        result.failures.length ? 'failed' : 'succeeded',
        JSON.stringify({ operator: actor.username, ...result }),
        id,
      ]);
      return result;
    } catch (error) {
      await db.run("UPDATE scheduler_runs SET status='failed',detail=? WHERE id=?", [
        JSON.stringify({ operator: actor.username, reason: copy.retention }),
        id,
      ]);
      throw error;
    }
  });
}
async function cleanArtifacts(db: Database, files: BackupFiles, actor: Actor): Promise<RetentionResult> {
  const rows = await activeArtifacts(db),
    now = Date.now();
  const plan = retentionPlan(rows.map(projectArtifact), now);
  const evidence = await db.all('SELECT artifact_id,prebackup_id FROM restore_verifications');
  for (const row of evidence) {
    plan.keep.add(String(row.artifact_id));
    if (row.prebackup_id) plan.keep.add(String(row.prebackup_id));
  }
  const result: RetentionResult = { deleted: [], retained: plan.keep.size, failures: [] };
  for (const row of rows) {
    const id = String(row.id);
    if (plan.keep.has(id)) {
      await db.run('UPDATE backup_artifacts SET retention_class=? WHERE id=?', [
        plan.monthly.has(id) ? 'monthly' : 'daily',
        id,
      ]);
      continue;
    }
    try {
      await expireArtifact(db, files, { row, actor });
      result.deleted.push(projectArtifact(row));
    } catch (error) {
      result.failures.push({ artifactId: id, reason: error instanceof AppError ? error.message : copy.retention });
    }
  }
  return result;
}
