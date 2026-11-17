import { Router } from 'express';
import type { Database } from '../../db/mysql.ts';
import { requireChannel } from '../../middleware/http.ts';
import { maintenanceController } from './controller.ts';
import { maintenanceAuth } from './auth.ts';
import { MaintenanceService } from './service.ts';

export function maintenanceRouter(db: Database, origins: string[], service: MaintenanceService): Router {
  const router = Router(),
    controller = maintenanceController(service);
  router.use((_req, res, next) => {
    res.set('Cache-Control', 'private, no-store');
    next();
  });
  router.use(maintenanceAuth(db), requireChannel('web', origins));
  router.post('/backups', controller.create!);
  router.get('/jobs', controller.jobs!);
  router.get('/artifacts', controller.artifacts!);
  router.get('/artifacts/:id/download', controller.download!);
  router.post('/retention', controller.retention!);
  router.get('/health', controller.health!);
  return router;
}
