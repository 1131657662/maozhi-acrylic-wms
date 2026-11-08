import { z } from 'zod';
import type { RequestHandler } from 'express';
import { exportRequestSchema, exportJobSchema } from '@wms/contracts';
import type { Database } from '../../db/mysql.ts';
import { ok, actorFrom } from '../../middleware/http.ts';
import { webExports } from './service.ts';

export function webExportController(
  db: Database,
): Record<'create' | 'get' | 'active' | 'cancel' | 'download', RequestHandler> {
  return {
    create: async (req, res) => {
      const job = await (await webExports(db)).create(exportRequestSchema.parse(req.body), actorFrom(res));
      res.status(202);
      ok(res, exportJobSchema.parse(job));
    },
    get: async (req, res) =>
      ok(res, exportJobSchema.parse(await (await webExports(db)).get(z.uuid().parse(req.params.id)))),
    active: async (_req, res) => ok(res, await (await webExports(db)).current()),
    cancel: async (req, res) =>
      ok(res, exportJobSchema.parse(await (await webExports(db)).cancel(z.uuid().parse(req.params.id)))),
    download: async (req, res, next) => {
      const artifact = await (await webExports(db)).download(z.uuid().parse(req.params.id));
      res.set('Cache-Control', 'private, no-store');
      res.download(artifact.path, artifact.name, { dotfiles: 'allow' }, (error) => {
        if (error && !res.headersSent) next(error);
      });
    },
  };
}
