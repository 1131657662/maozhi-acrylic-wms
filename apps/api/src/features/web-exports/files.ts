import { mkdir, writeFile, rename, readFile, readdir, rm, stat } from 'node:fs/promises';
import { createReadStream } from 'node:fs';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { exportJobSchema, type ExportJob } from '@wms/contracts';
import { AppError } from '../../shared/errors.ts';

export class ExportFiles {
  constructor(readonly root: string) {}
  file(id: string, extension: string): string {
    return path.join(this.root, `${id}.${extension}`);
  }
  async save(job: ExportJob): Promise<void> {
    await mkdir(this.root, { recursive: true });
    await writeFile(this.file(job.id, 'json.tmp'), JSON.stringify(job));
    await rename(this.file(job.id, 'json.tmp'), this.file(job.id, 'json'));
  }
  async restore(): Promise<ExportJob[]> {
    await mkdir(this.root, { recursive: true });
    const jobs: ExportJob[] = [];
    for (const name of await readdir(this.root)) {
      if (!/^[a-f0-9-]{36}\.json$/.test(name)) continue;
      const job = exportJobSchema.parse(JSON.parse(await readFile(path.join(this.root, name), 'utf8')));
      if (Date.parse(job.expiresAt) < Date.now()) {
        await this.remove(job.id);
        continue;
      }
      if (job.state === 'running') {
        Object.assign(job, {
          state: 'failed',
          errorCode: 'EXPORT_INTERRUPTED',
          error: '服务重启，导出未完成，请重新生成',
        });
        await this.discard(job.id);
        await this.save(job);
      }
      jobs.push(job);
    }
    return jobs;
  }
  async discard(id: string): Promise<void> {
    await Promise.all(['part', 'xlsx'].map((ext) => rm(this.file(id, ext), { force: true })));
  }
  async remove(id: string): Promise<void> {
    await this.discard(id);
    await rm(this.file(id, 'json'), { force: true });
  }
  async publish(id: string): Promise<{ sha256: string; bytes: number }> {
    const digest = createHash('sha256');
    for await (const chunk of createReadStream(this.file(id, 'part'))) digest.update(chunk);
    const bytes = (await stat(this.file(id, 'part'))).size;
    await rename(this.file(id, 'part'), this.file(id, 'xlsx'));
    return { sha256: digest.digest('hex'), bytes };
  }
  async verify(job: ExportJob): Promise<void> {
    try {
      const filename = this.file(job.id, 'xlsx');
      if ((await stat(filename)).size !== job.bytes) throw new Error('Export size changed');
      const digest = createHash('sha256');
      for await (const chunk of createReadStream(filename)) digest.update(chunk);
      if (digest.digest('hex') !== job.sha256) throw new Error('Export hash changed');
    } catch {
      throw new AppError('EXPORT_FILE_MISSING', '导出文件丢失或校验失败，请重新生成', 409);
    }
  }
}
