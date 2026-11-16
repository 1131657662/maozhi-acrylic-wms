import type { RequestHandler } from 'express';
import { z } from 'zod';
import type { Database } from '../../db/mysql.ts';
import { ok } from '../../middleware/http.ts';
import { dashboard } from './cache.ts';

export function dashboardController(db: Database): RequestHandler {
  return async (req, res) => {
    z.strictObject({}).parse(req.query);
    res.set('Cache-Control', 'no-store');
    ok(res, await dashboard(db));
  };
}
