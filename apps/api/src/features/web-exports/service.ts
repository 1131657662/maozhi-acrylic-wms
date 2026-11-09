import path from 'node:path';
import { type ExportJob, type ExportRequest } from '@wms/contracts';
import type { Database } from '../../db/mysql.ts';
import { AppError } from '../../shared/errors.ts';
import { hash } from '../../shared/hash.ts';
import { audit, type Actor } from '../../shared/audit.ts';
import { logger } from '../../shared/logger.ts';
import { ExportFiles } from './files.ts';
import { exportReader } from './read.ts';
import { generateSnapshot, requestedFields, type ExportHooks } from './generate.ts';
import { XlsxWriter } from './writer.ts';
import { newExportJob } from './job.ts';

export class WebExports {
  private jobs = new Map<string, ExportJob>();
  private cancellations = new Set<string>();
  private active: string | undefined;
  private ready: Promise<void>;
  private files: ExportFiles;
  constructor(
    private db: Database,
    root: string,
    readonly hooks: ExportHooks = {},
  ) {
    this.files = new ExportFiles(root);
    this.ready = this.restore();
  }
  private async restore(): Promise<void> {
    for (const job of await this.files.restore()) this.jobs.set(job.id, job);
  }
  async current(): Promise<ExportJob | null> {
    await this.ready;
    return this.active ? (this.jobs.get(this.active) ?? null) : null;
  }
  async get(id: string): Promise<ExportJob> {
    await this.ready;
    const job = this.jobs.get(id);
    if (!job || Date.parse(job.expiresAt) < Date.now())
      throw new AppError('EXPORT_EXPIRED', '导出不存在或已过期，请重新生成', 404);
    return job;
  }
  async create(request: ExportRequest, actor: Actor): Promise<ExportJob> {
    await this.ready;
    await this.expire();
    requestedFields(request);
    exportReader(request.kind, request.query);
    if (new Set(request.selected.map((r) => r.id)).size !== request.selected.length)
      throw new AppError('EXPORT_SELECTION', '选择记录重复', 422);
    const existing = this.jobs.get(request.requestId);
    if (existing) {
      if (existing.requestHash !== hash(JSON.stringify(request)))
        throw new AppError('IDEMPOTENCY_CONFLICT', '同一请求键不能改变导出参数', 409);
      return this.get(existing.id);
    }
    if (this.active) throw new AppError('EXPORT_BUSY', '已有导出在进行，请查看进度或取消后再试', 409);
    const job = newExportJob(request);
    this.active = job.id;
    this.jobs.set(job.id, job);
    try {
      await this.files.save(job);
    } catch (e) {
      this.active = undefined;
      this.jobs.delete(job.id);
      throw e;
    }
    void this.run(request, job, actor);
    return job;
  }
  private async expire(): Promise<void> {
    for (const job of this.jobs.values()) {
      if (job.id === this.active || Date.parse(job.expiresAt) >= Date.now()) continue;
      this.jobs.delete(job.id);
      await this.files.remove(job.id);
    }
  }
  async cancel(id: string): Promise<ExportJob> {
    const job = await this.get(id);
    if (job.state === 'running') {
      this.cancellations.add(id);
      job.error = '正在取消，请稍候';
    }
    return job;
  }
  async download(id: string): Promise<{ path: string; name: string }> {
    const job = await this.get(id);
    if (job.state !== 'ready') throw new AppError('EXPORT_NOT_READY', job.error ?? '导出尚未完成', 409);
    await this.files.verify(job);
    const names = {
      inbound: '入库',
      outbound: '出库',
      stock: 'ERP库存',
      audit: '操作日志',
      'report-details': '出入库明细',
      'report-monthly': '月度汇总',
      'report-turnover': '周转率',
      'report-aging': '库存库龄',
    };
    return {
      path: this.files.file(id, 'xlsx'),
      name: `${names[job.kind]}-${job.scope}-${job.createdAt.slice(0, 10)}.xlsx`,
    };
  }
  private ensureNotCancelled(job: ExportJob): void {
    if (this.cancellations.has(job.id)) throw new AppError('EXPORT_CANCELLED', '导出已取消，未提供部分文件', 409);
  }
  private async run(request: ExportRequest, job: ExportJob, actor: Actor): Promise<void> {
    let writer: XlsxWriter | undefined;
    try {
      writer = new XlsxWriter({
        filename: this.files.file(job.id, 'part'),
        kind: request.kind,
        fields: requestedFields(request),
      });
      await generateSnapshot(this.db, {
        request,
        job,
        writer,
        cancelled: () => this.cancellations.has(job.id),
        hooks: this.hooks,
      });
      await this.hooks.beforePublish?.();
      this.ensureNotCancelled(job);
      const artifact = await this.files.publish(job.id);
      this.ensureNotCancelled(job);
      await this.record(actor, job, 'export.generated');
      this.ensureNotCancelled(job);
      const complete: ExportJob = {
        ...job,
        ...artifact,
        state: 'ready',
        error: null,
        elapsedMs: Date.now() - Date.parse(job.createdAt),
      };
      await this.files.save(complete);
      this.ensureNotCancelled(job);
      Object.assign(job, complete);
    } catch (error) {
      await this.fail(job, actor, error, writer);
    } finally {
      this.active = undefined;
      this.cancellations.delete(job.id);
    }
  }
  private async fail(job: ExportJob, actor: Actor, error: unknown, writer?: XlsxWriter): Promise<void> {
    const known = error instanceof AppError;
    Object.assign(job, {
      state: known && error.code === 'EXPORT_CANCELLED' ? 'cancelled' : 'failed',
      error: known ? error.message : '导出失败，未提供部分文件。请重试或提供任务编号',
      errorCode: known ? error.code : 'EXPORT_FAILED',
      sha256: null,
      bytes: 0,
      elapsedMs: Date.now() - Date.parse(job.createdAt),
    });
    logger.error({ err: error, exportId: job.id }, 'export failed');
    try {
      await writer?.abort();
      await this.files.discard(job.id);
      await this.files.save(job);
      await this.record(actor, job, 'export.' + job.state);
    } catch (cleanupError) {
      logger.error({ err: cleanupError, exportId: job.id }, 'export cleanup failed');
    }
  }
  private async record(actor: Actor, job: ExportJob, action: string): Promise<void> {
    await audit(this.db, actor, {
      action,
      targetId: job.id,
      before: {},
      after: {
        kind: job.kind,
        scope: job.scope,
        columns: job.columns.map((c) => c.key),
        requestHash: job.requestHash,
        records: job.processed,
        errorCode: job.errorCode,
      },
    });
  }
}
const services = new WeakMap<Database, Promise<WebExports>>();
export function webExports(db: Database): Promise<WebExports> {
  let service = services.get(db);
  if (!service) {
    service = db.get('SELECT DATABASE() AS name').then((row) => {
      const name = String(row?.name);
      if (!/^[a-zA-Z0-9_]+$/.test(name)) throw new Error('Invalid export namespace');
      return new WebExports(db, path.resolve(process.env.INIT_CWD ?? process.cwd(), '.local/exports', name));
    });
    services.set(db, service);
  }
  return service;
}
