import type { Database } from '../../db/mysql.ts';
import { audit, type Actor } from '../../shared/audit.ts';
import { AppError } from '../../shared/errors.ts';
import { BackupFiles } from './files.ts';
import { mysqlDump } from './dump.ts';
import { verifyBackupConnection, type MaintenanceOptions } from './options.ts';
import { maintenanceErrors as copy } from './copy.ts';

interface BackupRun {
  id: string;
  actor: Actor;
  options: MaintenanceOptions;
}
export async function runBackup(db: Database, run: BackupRun): Promise<void> {
  try {
    await verifyBackupConnection(db, run.options);
    const files = new BackupFiles(run.options.directory);
    const estimate = await db.get(`SELECT COALESCE(SUM(DATA_LENGTH+INDEX_LENGTH),0) AS bytes
      FROM information_schema.TABLES WHERE TABLE_SCHEMA=DATABASE()`);
    await files.preflight(Number(estimate?.bytes));
    await db.run("UPDATE maintenance_jobs SET status='running' WHERE id=?", [run.id]);
    await mysqlDump(run.options.connection, files.file(run.id, 'part'));
    const digest = await files.publish(run.id);
    await completeBackup(db, run, digest);
  } catch (error) {
    const reason = error instanceof AppError ? error.message : copy.failed;
    await db.transaction(async (tx) => {
      await tx.run("UPDATE maintenance_jobs SET status='failed',finished_at=UTC_TIMESTAMP(3),error=? WHERE id=?", [
        reason,
        run.id,
      ]);
      await audit(tx, run.actor, {
        action: 'maintenance.backup.failed',
        targetId: run.id,
        before: null,
        after: { name: '数据库备份失败', reason },
      });
    });
  }
}
async function completeBackup(db: Database, run: BackupRun, digest: { bytes: number; sha256: string }): Promise<void> {
  await db.transaction(async (tx) => {
    await tx.run(
      `INSERT INTO backup_artifacts(id,job_id,path,bytes,sha256,created_at,retention_class)
      VALUES(?,?,?,?,?,UTC_TIMESTAMP(3),'daily')`,
      [run.id, run.id, `${run.id}.sql`, digest.bytes, digest.sha256],
    );
    await tx.run("UPDATE maintenance_jobs SET status='succeeded',finished_at=UTC_TIMESTAMP(3),result=? WHERE id=?", [
      JSON.stringify({ artifactId: run.id, ...digest }),
      run.id,
    ]);
    await audit(tx, run.actor, {
      action: 'maintenance.backup.complete',
      targetId: run.id,
      before: null,
      after: { name: '数据库备份', bytes: digest.bytes },
    });
  });
}
