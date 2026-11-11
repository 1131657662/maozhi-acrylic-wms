import { Router } from 'express';
import type { Database } from '../../db/mysql.ts';
import { requireChannel } from '../../middleware/http.ts';
import { webListController } from './controller.ts';

export function webListRouter(db: Database, origins: string[]): Router {
  const router = Router();
  const controller = webListController(db);
  router.use('/web/lists', requireChannel('web', origins));
  router.get('/web/lists/inbound', controller.inbound);
  router.get('/web/lists/outbound', controller.outbound);
  router.get('/web/lists/stock', controller.stock);
  router.get('/web/lists/:kind/statuses', controller.statuses);
  return router;
}
