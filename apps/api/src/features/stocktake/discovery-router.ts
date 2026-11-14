import { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import type { Database } from '../../db/mysql.ts';
import { actorFrom, ok } from '../../middleware/http.ts';
import { createDiscovery, updateDiscovery, deleteDiscovery } from './discovery-command.ts';

function command(req: Request, res: Response) {
  return {
    id: z.uuid().parse(req.params.id),
    ...(req.params.lineId ? { lineId: z.uuid().parse(req.params.lineId) } : {}),
    input: req.body,
    key: z.uuid().parse(req.get('Idempotency-Key')),
    actor: actorFrom(res),
  };
}
export function discoveryRouter(db: Database) {
  const router = Router();
  for (const base of ['/stocktake/:id/discoveries', '/stocktakes/:id/discoveries']) {
    router.post(base, async (req, res) => ok(res, await createDiscovery(db, command(req, res))));
    router.patch(`${base}/:lineId`, async (req, res) => ok(res, await updateDiscovery(db, command(req, res))));
    router.delete(`${base}/:lineId`, async (req, res) => ok(res, await deleteDiscovery(db, command(req, res))));
  }
  return router;
}
