import { Router } from 'express';
import type { Database } from '../../db/mysql.ts';
import { requireChannel } from '../../middleware/http.ts';
import { stocktakeController } from './controller.ts';
import { discoveryRouter } from './discovery-router.ts';

export function stocktakeRouter(db: Database, origins: string[]): Router {
  const router = Router(),
    controller = stocktakeController(db);
  router.use('/stocktakes', requireChannel('web', origins));
  router.use('/stocktake', requireChannel('web', origins));
  router.use(discoveryRouter(db));
  router.post('/stocktake/:id/reveal', controller.reveal);
  router.get('/stocktakes', controller.list);
  router.get('/stocktakes/options/products', controller.products);
  router.post('/stocktakes', controller.create);
  router.get('/stocktakes/:id', controller.detail);
  router.get('/stocktakes/:id/lines', controller.lines);
  router.get('/stocktakes/:id/preview', controller.preview);
  router.get('/stocktakes/:id/export', controller.export);
  router.post('/stocktakes/:id/reveal', controller.reveal);
  router.put('/stocktakes/:id/lines/:product', controller.save);
  router.post('/stocktakes/:id/void', controller.void);
  router.post('/stocktakes/:id/post', controller.post);
  return router;
}
