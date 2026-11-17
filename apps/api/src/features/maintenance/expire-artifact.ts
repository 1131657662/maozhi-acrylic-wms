import { unlink, lstat } from 'node:fs/promises';
import type { Database, Row } from '../../db/mysql.ts';
import { audit, type Actor } from '../../shared/audit.ts';
import { AppError } from '../../shared/errors.ts';
import { BackupFiles } from './files.ts';
import { maintenanceErrors as copy } from './copy.ts';

async function removeOwned(db: Database, files: BackupFiles, row: Row): Promise<void> {
  const id = String(row.id),
    filename = files.file(id, 'sql');
  const pending = await db.get(
    "SELECT JSON_UNQUOTE(JSON_EXTRACT(result,'$.pendingDeletionAt')) AS pending FROM maintenance_jobs WHERE id=?",
    [String(row.job_id)],
  );
  const info = await lstat(filename).catch((error: NodeJS.ErrnoException) => {
    if (error.code === 'ENOENT') return null;
    throw error;
  });
  if (!info) {
    if (pending?.pending && row.path === `${id}.sql`) return;
    throw new AppError('BACKUP_FILE', copy.file, 409);
  }
  const handle = await files.openOwned(id, String(row.path));
  await handle.close();
  await db.run(
    "UPDATE maintenance_jobs SET result=JSON_SET(COALESCE(result,JSON_OBJECT()),'$.pendingDeletionAt',?) WHERE id=?",
    [new Date().toISOString(), String(row.job_id)],
  );
  await unlink(filename);
}
export async function expireArtifact(
  db: Database,
  files: BackupFiles,
  input: { row: Row; actor: Actor },
): Promise<void> {
  await removeOwned(db, files, input.row);
  await db.transaction(async (tx) => {
    await tx.run(
      "UPDATE maintenance_jobs SET result=JSON_SET(COALESCE(result,JSON_OBJECT()),'$.deletedAt',?) WHERE id=?",
      [new Date().toISOString(), String(input.row.job_id)],
    );
    await audit(tx, input.actor, {
      action: 'maintenance.retention',
      targetId: String(input.row.id),
      before: { name: '过期备份文件' },
      after: { name: '已清理过期备份，历史记录保留' },
    });
  });
}
