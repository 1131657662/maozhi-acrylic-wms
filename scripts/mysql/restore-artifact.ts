import path from 'node:path';
import { copyFile, lstat, realpath } from 'node:fs/promises';
import { constants } from 'node:fs';
import { randomUUID } from 'node:crypto';
import type { Database } from '../../apps/api/src/db/mysql.ts';
import type { Actor } from '../../apps/api/src/shared/audit.ts';
import { audit } from '../../apps/api/src/shared/audit.ts';
import { BackupFiles } from '../../apps/api/src/features/maintenance/files.ts';
import { insertBackup } from '../../apps/api/src/features/maintenance/jobs.ts';
import { withMaintenanceLock } from '../../apps/api/src/features/maintenance/lock.ts';
import type { MaintenanceOptions } from '../../apps/api/src/features/maintenance/options.ts';

export async function registerLegacyRestore(
  db: Database,
  actor: Actor,
  input: { filename: string; root: string; options: MaintenanceOptions },
): Promise<string> {
  const info = await lstat(input.filename);
  if (
    !info.isFile() ||
    info.isSymbolicLink() ||
    info.size <= 0 ||
    (await lstat(input.root)).isSymbolicLink() ||
    path.dirname(await realpath(input.filename)) !== (await realpath(input.root)) ||
    !/^maozhi-\d+\.sql$/.test(path.basename(input.filename))
  )
    throw new Error('旧备份文件归属或大小不符');
  return withMaintenanceLock(db, async () => {
    const files = new BackupFiles(input.options.directory);
    await files.preflight(info.size);
    const id = await insertBackup(db, actor, randomUUID());
    try {
      await copyFile(input.filename, files.file(id, 'part'), constants.COPYFILE_EXCL);
      const digest = await files.publish(id);
      await recordLegacy(db, { id, actor, digest });
      return id;
    } catch (error) {
      await db.run(
        "UPDATE maintenance_jobs SET status='failed',finished_at=UTC_TIMESTAMP(3),error='旧备份登记失败，已有文件保留' WHERE id=?",
        [id],
      );
      throw error;
    }
  });
}
async function recordLegacy(
  db: Database,
  input: { id: string; actor: Actor; digest: { bytes: number; sha256: string } },
): Promise<void> {
  await db.transaction(async (tx) => {
    await tx.run(
      "INSERT INTO backup_artifacts(id,job_id,path,bytes,sha256,created_at,retention_class) VALUES(?,?,?,?,?,UTC_TIMESTAMP(3),'daily')",
      [input.id, input.id, `${input.id}.sql`, input.digest.bytes, input.digest.sha256],
    );
    await tx.run("UPDATE maintenance_jobs SET status='succeeded',finished_at=UTC_TIMESTAMP(3),result=? WHERE id=?", [
      JSON.stringify({ artifactId: input.id, legacySource: true }),
      input.id,
    ]);
    await audit(tx, input.actor, {
      action: 'maintenance.backup.complete',
      targetId: input.id,
      before: null,
      after: { name: '旧备份复制登记（无基线）', bytes: input.digest.bytes },
    });
  });
}
