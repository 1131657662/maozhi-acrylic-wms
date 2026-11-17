import { backupBaselineSchema, restoreReportSchema } from '@wms/contracts';
import type { Database } from '../../db/mysql.ts';
import type { Actor } from '../../shared/audit.ts';
import { AppError } from '../../shared/errors.ts';
import { lockRestoreAccount, type RestoreOwnership } from './restore-account.ts';
import { jsonValue, restoreAudit, restoreEvidence, restoreRow, saveRestoreReport } from './restore-records.ts';
import { restoreText as t } from './restore-copy.ts';

export async function finishRestoreAccount(db: Database, owner: RestoreOwnership): Promise<void> {
  try {
    const retained = await lockRestoreAccount(owner);
    await db.run('UPDATE restore_verifications SET database_created=? WHERE job_id=?', [
      Number(retained.database),
      owner.jobId,
    ]);
    if (!retained.account) return;
    await db.run('UPDATE restore_verifications SET account_created=TRUE,account_locked=TRUE WHERE job_id=?', [
      owner.jobId,
    ]);
    const row = await restoreRow(db, owner.jobId);
    await restoreEvidence(db, owner.jobId, {
      stage: row.stage as 'provision' | 'import' | 'verify',
      message: t.locked,
    });
  } catch {
    const row = await restoreRow(db, owner.jobId);
    await restoreEvidence(db, owner.jobId, {
      stage: row.stage as 'provision' | 'import' | 'verify',
      message: t.lockFailed,
    });
    throw new AppError('RESTORE_ACCOUNT_LOCK', t.lockFailed, 503);
  }
}
export async function failRestore(
  db: Database,
  input: { id: string; actor: Actor; error: unknown; interrupted?: boolean },
): Promise<void> {
  const row = await restoreRow(db, input.id);
  const message = input.interrupted ? t.interrupted : input.error instanceof AppError ? input.error.message : t.failed;
  const existing = row.report ? restoreReportSchema.parse(jsonValue(row.report)) : null;
  const artifact = await db.get('SELECT baseline FROM backup_artifacts WHERE id=?', [String(row.artifact_id)]);
  const baseline = backupBaselineSchema.safeParse(jsonValue(artifact?.baseline));
  const report = existing ?? {
    outcome: 'failed' as const,
    baselineAt: baseline.success ? baseline.data.capturedAt : null,
    verifiedAt: null,
    items: [],
  };
  if (report.outcome !== 'mismatch') report.outcome = input.interrupted ? 'interrupted' : 'failed';
  await saveRestoreReport(db, input.id, report);
  await restoreEvidence(db, input.id, {
    stage: row.stage as 'backup' | 'provision' | 'import' | 'verify' | 'report',
    message,
  });
  await db.transaction(async (tx) => {
    await tx.run('UPDATE maintenance_jobs SET status=?,finished_at=UTC_TIMESTAMP(3),error=? WHERE id=?', [
      input.interrupted ? 'interrupted' : 'failed',
      message,
      input.id,
    ]);
    await restoreAudit(tx, input.actor, { id: input.id, action: 'maintenance.restore.failed', message: t.failed });
  });
}
