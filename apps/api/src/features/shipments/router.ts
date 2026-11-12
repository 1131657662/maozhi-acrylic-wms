import { Router } from 'express';
import type { Database } from '../../db/mysql.ts';
import { requireChannel } from '../../middleware/http.ts';
import { shipmentController } from './controller.ts';

export function shipmentRouter(db: Database, origins: string[]) {
  const router = Router(),
    controller = shipmentController(db),
    web = requireChannel('web', origins);
  router.get('/outbound/:id/shipments', web, controller.list);
  router.post('/outbound/:id/shipments', web, controller.create);
  router.post('/outbound/:id/confirm', web, controller.create);
  router.post('/outbound/:id/complete', web, controller.complete);
  router.post('/outbound/:id/short-close', web, controller.shortClose);
  router.patch('/outbound/:id/plan', web, controller.plan);
  return router;
}
