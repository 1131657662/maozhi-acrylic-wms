import { Router } from 'express';
import type { Database } from '../../db/mysql.ts';
import { requireChannel } from '../../middleware/http.ts';
import { webExportController } from './controller.ts';
export function webExportRouter(db: Database, origins: string[]): Router {
  const router = Router();
  const c = webExportController(db);
  router.use('/web/exports', requireChannel('web', origins));
  router.post('/web/exports', c.create);
  router.get('/web/exports/active', c.active);
  router.get('/web/exports/:id', c.get);
  router.post('/web/exports/:id/cancel', c.cancel);
  router.get('/web/exports/:id/download', c.download);
  return router;
}
