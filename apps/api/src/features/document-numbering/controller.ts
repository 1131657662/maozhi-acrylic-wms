import type { Request, Response } from 'express';
import { z } from 'zod';
import { documentKindSchema } from '@wms/contracts';
import type { Database } from '../../db/mysql.ts';
import { actorFrom, ok } from '../../middleware/http.ts';
import { listNumbering, updateNumbering } from './service.ts';

export function numberingController(db: Database) {
  return {
    list: async (_req: Request, res: Response): Promise<void> => ok(res, await listNumbering(db)),
    update: async (req: Request, res: Response): Promise<void> =>
      ok(
        res,
        await updateNumbering(
          db,
          documentKindSchema.parse(req.params.kind),
          req.body,
          z.uuid().parse(req.get('idempotency-key')),
          actorFrom(res),
        ),
      ),
  };
}
