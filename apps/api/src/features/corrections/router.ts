import { Router } from 'express';
import type { Database } from '../../db/mysql.ts';
import { requireChannel } from '../../middleware/http.ts';
import { correctionController } from './controller.ts';

export function correctionRouter(db: Database, origins: string[]): Router {
  const router = Router(),
    controller = correctionController(db),
    web = requireChannel('web', origins);
  router.post('/:kind/:id/corrections', web, controller.create);
  router.get('/:kind/:id/corrections', web, controller.list);
  router.get('/corrections/:id', web, controller.detail);
  router.patch('/:kind/:id/business-date', web, controller.date);
  return router;
}
