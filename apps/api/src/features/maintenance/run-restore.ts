import type { Database, DatabaseConfig } from '../../db/mysql.ts';
import type { Actor } from '../../shared/audit.ts';
import { AppError } from '../../shared/errors.ts';
import type { MaintenanceOptions } from './options.ts';
import { verifiedDownload } from './download.ts';
import { readArtifact } from './artifacts.ts';
import {
  createRestoreAccount,
  createRestoreDatabase,
  newRestoreOwnership,
  type RestoreOwnership,
} from './restore-account.ts';
import { restoreAudit, restoreEvidence } from './restore-records.ts';
import { verifiedPrebackup } from './restore-prebackup.ts';
import { importRestore } from './restore-import.ts';
import { verifyRestore } from './restore-verify.ts';
import { failRestore, finishRestoreAccount } from './restore-finish.ts';
import { restoreText as t } from './restore-copy.ts';

export interface RestoreRun {
  id: string;
  artifactId: string;
  actor: Actor;
  options: MaintenanceOptions;
}
export async function runRestore(db: Database, run: RestoreRun): Promise<void> {
  try {
    await restoreStages(db, run);
  } catch (error) {
    await failRestore(db, { id: run.id, actor: run.actor, error });
  }
}
async function restoreStages(db: Database, run: RestoreRun): Promise<void> {
  const source = await verifiedDownload(db, run.options, run.artifactId);
  try {
    await db.run("UPDATE maintenance_jobs SET status='running' WHERE id=?", [run.id]);
    await restoreEvidence(db, run.id, { stage: 'backup', message: t.backup });
    await verifiedPrebackup(db, { actor: run.actor, options: run.options, restoreId: run.id });
    const owner = newRestoreOwnership(run.id, run.options.connection.database!);
    await restoreEvidence(db, run.id, { stage: 'provision', message: t.provision });
    await db.run('UPDATE restore_verifications SET database_name=?,account_name=? WHERE job_id=?', [
      owner.database,
      owner.account,
      run.id,
    ]);
    try {
      const config = await provisionRestore(db, run, owner);
      await importAndVerify(db, run, { config, source });
    } finally {
      await finishRestoreAccount(db, owner);
    }
    await restoreEvidence(db, run.id, { stage: 'report', message: t.report });
    await db.transaction(async (tx) => {
      await tx.run("UPDATE maintenance_jobs SET status='succeeded',finished_at=UTC_TIMESTAMP(3) WHERE id=?", [run.id]);
      await restoreAudit(tx, run.actor, { id: run.id, action: 'maintenance.restore.complete', message: t.report });
    });
  } finally {
    await source.close();
  }
}
async function provisionRestore(db: Database, run: RestoreRun, owner: RestoreOwnership): Promise<DatabaseConfig> {
  await createRestoreDatabase(owner);
  await db.run('UPDATE restore_verifications SET database_created=TRUE WHERE job_id=?', [run.id]);
  return createRestoreAccount(owner, () =>
    db.transaction(async (tx) => {
      await tx.run('UPDATE restore_verifications SET account_created=TRUE WHERE job_id=?', [run.id]);
      await restoreAudit(tx, run.actor, { id: run.id, action: 'maintenance.restore.account', message: t.account });
    }),
  );
}
async function importAndVerify(
  db: Database,
  run: RestoreRun,
  input: { config: DatabaseConfig; source: import('node:fs/promises').FileHandle },
): Promise<void> {
  await restoreEvidence(db, run.id, { stage: 'import', message: t.import });
  try {
    await importRestore(input.source.createReadStream({ start: 0, autoClose: false }), input.config);
  } catch (error) {
    await restoreAudit(db, run.actor, {
      id: run.id,
      action: 'maintenance.restore.import.failed',
      message: t.importFailed,
    });
    await restoreEvidence(db, run.id, {
      stage: 'import',
      message: error instanceof AppError ? error.message : t.importFailed,
    });
    throw error;
  }
  await restoreAudit(db, run.actor, { id: run.id, action: 'maintenance.restore.import', message: '备份已导入隔离库' });
  await restoreEvidence(db, run.id, { stage: 'verify', message: t.verify });
  const artifact = await readArtifact(db, run.artifactId);
  const report = await verifyRestore(db, { id: run.id, config: input.config, baseline: artifact.baseline });
  if (report.outcome === 'mismatch') throw new AppError('RESTORE_MISMATCH', t.mismatch, 409);
}
