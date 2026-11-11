import type { Request, Response } from 'express';
import type { Database } from '../../db/mysql.ts';
import { z } from 'zod';
import { scanRequestSchema, idSchema, revisionSchema, sessionSchema } from '@wms/contracts';
import { pdaScanProjection } from './projection.ts';
import { recordFact } from './service.ts';
import { freezePlan } from './freeze.ts';
import { listCatalog } from './catalog.ts';
import { actorFrom, ok } from '../../middleware/http.ts';
import { tokenFrom } from '../../middleware/http.ts';
import { hash } from '../../shared/hash.ts';
import { noteLegacyClient } from '../catalog/gate.ts';

export function scanController(db: Database) {
  return {
    catalog: async (req: Request, res: Response): Promise<void> => {
      if (sessionSchema.parse(res.locals.session).channel === 'pda')
        await noteLegacyClient(db, `session:${hash(tokenFrom(req))}`);
      ok(res, await listCatalog(db));
    },
    fact: async (req: Request, res: Response): Promise<void> => {
      const input = scanRequestSchema.parse(req.body);
      const current = 'schemaVersion' in input;
      const fact = current ? input.fact : input;
      if (!current) await noteLegacyClient(db, `device:${fact.deviceId}`);
      ok(
        res,
        pdaScanProjection(
          await recordFact(db, {
            planId: idSchema.parse(req.params.id),
            fact,
            actor: actorFrom(res),
            ...(current ? { context: input.context } : {}),
          }),
        ),
      );
    },
    freeze: async (req: Request, res: Response): Promise<void> =>
      ok(
        res,
        pdaScanProjection(
          await freezePlan(db, {
            planId: idSchema.parse(req.params.id),
            key: z.uuid().parse(req.get('idempotency-key')),
            expected: revisionSchema.parse(req.body),
            actor: actorFrom(res),
          }),
        ),
      ),
  };
}
