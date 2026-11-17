import type { FileHandle } from 'node:fs/promises';
import type { Database } from '../../db/mysql.ts';
import { AppError } from '../../shared/errors.ts';
import { BackupFiles, fileDigest } from './files.ts';
import { readArtifact } from './artifacts.ts';
import type { MaintenanceOptions } from './options.ts';
import { maintenanceErrors as copy } from './copy.ts';

export async function verifiedDownload(db: Database, options: MaintenanceOptions, id: string): Promise<FileHandle> {
  const row = await readArtifact(db, id);
  const files = new BackupFiles(options.directory);
  const handle = await files.openOwned(id, String(row.path));
  try {
    const digest = await fileDigest(handle);
    if (digest.bytes !== Number(row.bytes) || digest.sha256 !== row.sha256)
      throw new AppError('BACKUP_CORRUPT', copy.corrupt, 409);
    return handle;
  } catch (error) {
    await handle.close();
    throw error;
  }
}
