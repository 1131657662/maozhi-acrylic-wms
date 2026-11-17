import { Router } from 'express';
import type { Database } from '../../db/mysql.ts';
import { requireAuth, requireChannel } from '../../middleware/http.ts';
import { accountController } from './account-controller.ts';

export function accountRouter(db: Database, origins: string[]): Router {
  const router = Router();
  const controller = accountController(db);
  router.use(requireAuth(db), requireChannel('web', origins));
  router.get('/', controller.read);
  router.put('/profile', controller.profile);
  router.post('/password', controller.password);
  router.get('/sessions', controller.sessions);
  router.delete('/sessions/:id', controller.revoke);
  router.post('/logout', controller.exit);
  return router;
}
