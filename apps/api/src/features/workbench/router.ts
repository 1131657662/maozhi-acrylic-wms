import { Router } from 'express';
import type { Database } from '../../db/mysql.ts';
import { requireChannel } from '../../middleware/http.ts';
import { dashboardController } from './controller.ts';

export function dashboardRouter(db: Database, origins: string[]): Router {
  const router = Router();
  router.get('/web/dashboard', requireChannel('web', origins), dashboardController(db));
  return router;
}
