import { Router } from 'express';
import type { Database } from '../../db/mysql.ts';
import { requireAuth, requireChannel } from '../../middleware/http.ts';
import { messageController } from './controller.ts';

export function messageRouter(db: Database, origins: string[]): Router {
  const router = Router(),
    controller = messageController(db);
  router.use(requireAuth(db), requireChannel('web', origins));
  router.use((_req, res, next) => {
    res.set('Cache-Control', 'private, no-store');
    next();
  });
  router.get('/', controller.list);
  router.get('/unread-count', controller.count);
  router.post('/read-all', controller.readAll);
  router.post('/:id/read', controller.read);
  return router;
}
