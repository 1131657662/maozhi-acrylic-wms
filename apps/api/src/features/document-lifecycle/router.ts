import { Router } from 'express';
import { z } from 'zod';
import { idSchema, lifecycleCommandSchema } from '@wms/contracts';
import type { Database } from '../../db/mysql.ts';
import { actorFrom, ok, requireChannel } from '../../middleware/http.ts';
import { lifecyclePreview } from './preview.ts';
import { executeLifecycle } from './execute.ts';

export function lifecycleRouter(db: Database, origins: string[]): Router {
  const router = Router();
  for (const kind of ['inbound', 'outbound'] as const) {
    router.get(`/${kind}/:id/lifecycle`, requireChannel('web', origins), async (req, res) => {
      const id = idSchema.parse(req.params.id);
      ok(res, await db.readSnapshot((tx) => lifecyclePreview(tx, { kind, id })));
    });
    for (const action of ['reverse', 'void'] as const) {
      router.post(`/${kind}/:id/${action}`, requireChannel('web', origins), async (req, res) => {
        ok(
          res,
          await executeLifecycle(db, {
            kind,
            action,
            id: idSchema.parse(req.params.id),
            key: z.uuid().parse(req.get('idempotency-key')),
            input: lifecycleCommandSchema.parse(req.body),
            actor: actorFrom(res),
          }),
        );
      });
    }
  }
  return router;
}
