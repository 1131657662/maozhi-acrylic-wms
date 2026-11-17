import { randomUUID } from 'node:crypto';
import type { FileHandle } from 'node:fs/promises';
import type { Database } from '../../db/mysql.ts';
import type { Actor } from '../../shared/audit.ts';
import { AppError } from '../../shared/errors.ts';
import type { MaintenanceOptions } from './options.ts';
import { insertBackup } from './jobs.ts';
import { runBackup } from './run-backup.ts';
import { verifiedDownload } from './download.ts';
import { restoreText as t } from './restore-copy.ts';

export async function verifiedPrebackup(
  db: Database,
  input: { actor: Actor; options: MaintenanceOptions; restoreId: string },
): Promise<void> {
  const id = await insertBackup(db, input.actor, randomUUID());
  await db.run('UPDATE maintenance_jobs SET params=? WHERE id=?', [
    JSON.stringify({ restoreJobId: input.restoreId }),
    id,
  ]);
  await runBackup(db, { id, actor: input.actor, options: input.options });
  if (await db.get('SELECT id FROM backup_artifacts WHERE id=?', [id]))
    await db.run('UPDATE restore_verifications SET prebackup_id=? WHERE job_id=?', [id, input.restoreId]);
  const handle = await verifySuccessfulBackup(db, input.options, id);
  await handle.close();
}
export async function verifySuccessfulBackup(
  db: Database,
  options: MaintenanceOptions,
  id: string,
): Promise<FileHandle> {
  try {
    const job = await db.get('SELECT status FROM maintenance_jobs WHERE id=?', [id]);
    const artifact = await db.get('SELECT bytes FROM backup_artifacts WHERE id=?', [id]);
    if (job?.status !== 'succeeded' || !(Number(artifact?.bytes) > 0)) throw new Error('prebackup failed');
    return await verifiedDownload(db, options, id);
  } catch {
    throw new AppError('RESTORE_PREBACKUP_FAILED', t.prebackup, 409);
  }
}
