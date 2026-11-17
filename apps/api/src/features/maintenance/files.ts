import { mkdir, lstat, realpath, open, rename, statfs, type FileHandle } from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { z } from 'zod';
import { MAINTENANCE } from '@wms/contracts';
import { AppError } from '../../shared/errors.ts';
import { maintenanceErrors as copy } from './copy.ts';

export class BackupFiles {
  constructor(readonly root: string) {}
  async prepare(): Promise<void> {
    await mkdir(this.root, { recursive: true, mode: 0o700 });
    if ((await lstat(this.root)).isSymbolicLink()) throw new AppError('BACKUP_FILE', copy.file, 409);
  }
  file(id: string, extension: 'sql' | 'part'): string {
    return path.join(this.root, `${z.uuid().parse(id)}.${extension}`);
  }
  async freeBytes(): Promise<number> {
    const info = await statfs(this.root);
    return info.bavail * info.bsize;
  }
  async preflight(estimatedBytes: number): Promise<void> {
    await this.prepare();
    if ((await this.freeBytes()) < Math.max(MAINTENANCE.minFreeBytes, estimatedBytes * MAINTENANCE.diskEstimateFactor))
      throw new AppError('BACKUP_DISK_LOW', copy.disk, 409);
  }
  async publish(id: string): Promise<{ bytes: number; sha256: string }> {
    const handle = await open(this.file(id, 'part'), 'r');
    let digest;
    try {
      digest = await fileDigest(handle);
    } finally {
      await handle.close();
    }
    if (!digest.bytes) throw new AppError('BACKUP_EMPTY', copy.failed, 409);
    await rename(this.file(id, 'part'), this.file(id, 'sql'));
    return digest;
  }
  async openOwned(id: string, reference: string): Promise<FileHandle> {
    if (reference !== `${z.uuid().parse(id)}.sql`) throw new AppError('BACKUP_FILE', copy.file, 409);
    const filename = this.file(id, 'sql');
    try {
      if ((await lstat(this.root)).isSymbolicLink()) throw new Error('invalid root');
      const info = await lstat(filename);
      if (
        !info.isFile() ||
        info.isSymbolicLink() ||
        path.dirname(await realpath(filename)) !== (await realpath(this.root))
      )
        throw new Error('invalid ownership');
      return await open(filename, 'r');
    } catch {
      throw new AppError('BACKUP_FILE', copy.file, 409);
    }
  }
}
export async function fileDigest(handle: FileHandle): Promise<{ bytes: number; sha256: string }> {
  const hash = createHash('sha256');
  let bytes = 0;
  for await (const chunk of handle.createReadStream({ start: 0, autoClose: false })) {
    hash.update(chunk);
    bytes += Buffer.byteLength(chunk);
  }
  return { bytes, sha256: hash.digest('hex') };
}
