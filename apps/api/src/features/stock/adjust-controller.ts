import { z } from 'zod';
import type { Request, Response } from 'express';
import { stockAdjustmentSchema } from '@wms/contracts';
import type { Database } from '../../db/mysql.ts';
import { actorFrom, ok } from '../../middleware/http.ts';
import { adjustStock } from './adjust.ts';

export function stockAdjustmentController(db: Database) {
  return async (req: Request, res: Response): Promise<void> => {
    ok(
      res,
      await adjustStock(
        db,
        stockAdjustmentSchema.parse(req.body),
        z.uuid().parse(req.get('idempotency-key')),
        actorFrom(res),
      ),
    );
  };
}
