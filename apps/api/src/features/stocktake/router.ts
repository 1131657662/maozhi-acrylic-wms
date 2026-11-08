import { Router } from 'express';
import type { Database } from '../../db/mysql.ts';
import { requireChannel } from '../../middleware/http.ts';
import { stocktakeController } from './controller.ts';

export function stocktakeRouter(db: Database, origins: string[]): Router {
  const router = Router(),
    controller = stocktakeController(db);
  router.use('/stocktakes', requireChannel('web', origins));
  router.get('/stocktakes', controller.list);
  router.get('/stocktakes/options/products', controller.products);
  router.post('/stocktakes', controller.create);
  router.get('/stocktakes/:id', controller.detail);
  router.get('/stocktakes/:id/lines', controller.lines);
  router.get('/stocktakes/:id/preview', controller.preview);
  router.put('/stocktakes/:id/lines/:product', controller.save);
  router.post('/stocktakes/:id/void', controller.void);
  router.post('/stocktakes/:id/post', controller.post);
  return router;
}
