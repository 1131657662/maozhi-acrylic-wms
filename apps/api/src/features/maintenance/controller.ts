import type { RequestHandler } from 'express';
import { z } from 'zod';
import { maintenanceJobsQuerySchema, maintenancePageQuerySchema } from '@wms/contracts';
import { actorFrom, ok } from '../../middleware/http.ts';
import { AppError } from '../../shared/errors.ts';
import { listMaintenanceJobs } from './jobs.ts';
import { listArtifacts } from './artifacts.ts';
import { verifiedDownload } from './download.ts';
import { retainBackups } from './retention.ts';
import { maintenanceHealth } from './health.ts';
import { MaintenanceService } from './service.ts';
import { BackupFiles } from './files.ts';
import { maintenanceErrors as copy } from './copy.ts';

export function maintenanceController(service: MaintenanceService): Record<string, RequestHandler> {
  return {
    create: async (req, res) => {
      z.strictObject({}).parse(req.body);
      const key = z.uuid().parse(req.get('Idempotency-Key'));
      const result = await service.create(actorFrom(res), key);
      res.status(202);
      ok(res, result);
    },
    jobs: async (req, res) =>
      ok(res, { items: await listMaintenanceJobs(service.db, maintenanceJobsQuerySchema.parse(req.query)) }),
    artifacts: async (req, res) =>
      ok(res, await listArtifacts(service.db, maintenancePageQuerySchema.parse(req.query))),
    download: downloadController(service),
    retention: async (req, res) => {
      z.strictObject({}).parse(req.body);
      if (!service.options) throw new AppError('BACKUP_UNAVAILABLE', copy.unavailable, 503);
      ok(res, await retainBackups(service.db, new BackupFiles(service.options.directory), actorFrom(res)));
    },
    health: async (req, res) => {
      z.strictObject({}).parse(req.query);
      ok(res, await maintenanceHealth(service.db, service.options));
    },
  };
}
function downloadController(service: MaintenanceService): RequestHandler {
  return async (req, res, next) => {
    if (!service.options) throw new AppError('BACKUP_UNAVAILABLE', copy.unavailable, 503);
    const handle = await verifiedDownload(service.db, service.options, z.uuid().parse(req.params.id));
    res.attachment('数据库备份.sql').type('application/sql');
    const stream = handle.createReadStream({ start: 0, autoClose: true });
    res.once('close', () => stream.destroy());
    stream.once('error', next);
    stream.pipe(res);
  };
}
