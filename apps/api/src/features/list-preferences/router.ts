import { Router } from 'express';
import type { Database } from '../../db/mysql.ts';
import { requireChannel } from '../../middleware/http.ts';
import { preferencesController } from './controller.ts';

export function listPreferencesRouter(db: Database, origins: string[]): Router {
  const router = Router();
  const controller = preferencesController(db);
  router.get('/me/list-preferences/:kind', requireChannel('web', origins), controller.read);
  router.put('/me/list-preferences/:kind', requireChannel('web', origins), controller.save);
  return router;
}
