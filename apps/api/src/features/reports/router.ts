import { Router } from 'express';
import { reportKindSchema, reportQuerySchema, reportDetailsSchema, reportMonthlySchema } from '@wms/contracts';
import type { Database } from '../../db/mysql.ts';
import { ok, requireChannel } from '../../middleware/http.ts';
import { readReport } from './read.ts';

export function reportRouter(db: Database, origins: string[]): Router {
  const router = Router();
  router.use('/web/reports', requireChannel('web', origins));
  router.get('/web/reports/:kind', async (req, res) => {
    const kind = reportKindSchema.parse('report-' + String(req.params.kind));
    const data = await readReport(db, kind, reportQuerySchema.parse(req.query));
    ok(res, (kind === 'report-details' ? reportDetailsSchema : reportMonthlySchema).parse(data));
  });
  return router;
}
