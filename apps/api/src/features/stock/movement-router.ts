import { Router } from 'express';
import { stockMovementQuerySchema, stockPeekInputSchema } from '@wms/contracts';
import type { Database } from '../../db/mysql.ts';
import { ok, requireChannel } from '../../middleware/http.ts';
import { readStockPeek } from './peek.ts';
import { readStockMovements } from './movements.ts';

export function stockMovementRouter(db: Database, origins: string[]): Router {
  const router = Router();
  router.post('/stock/peek', requireChannel('web', origins), async (req, res) => {
    ok(res, await readStockPeek(db, stockPeekInputSchema.parse(req.body)));
  });
  router.get('/stock/movements', requireChannel('web', origins), async (req, res) => {
    ok(res, await readStockMovements(db, stockMovementQuerySchema.parse(req.query)));
  });
  return router;
}
