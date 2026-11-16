import { Router } from 'express';
import { analysisQuerySchema, analysisSchema } from '@wms/contracts';
import type { Database } from '../../db/mysql.ts';
import { ok, requireChannel } from '../../middleware/http.ts';
import { analysis } from './cache.ts';

export function analysisRouter(db: Database, origins: string[]): Router {
  const router = Router();
  router.get('/web/analysis', requireChannel('web', origins), async (req, res) => {
    const query = analysisQuerySchema.parse(req.query);
    res.set('Cache-Control', 'no-store');
    ok(res, analysisSchema.parse(await analysis(db, query)));
  });
  return router;
}
