import { Router } from 'express';
import { z } from 'zod';
import { correctionDocumentIdSchema, correctionKindSchema } from '@wms/contracts';
import type { Database } from '../../db/mysql.ts';
import { actorFrom, ok, requireChannel } from '../../middleware/http.ts';
import { createDateCorrection } from './create.ts';
import { readDateCorrections } from './read.ts';

export function dateCorrectionRouter(db: Database, origins: string[]) {
  const router = Router(),
    web = requireChannel('web', origins);
  router.post('/:kind/:id/date-corrections', web, async (req, res) => {
    ok(
      res,
      await createDateCorrection(db, {
        kind: correctionKindSchema.parse(req.params.kind),
        id: correctionDocumentIdSchema.parse(req.params.id),
        input: req.body,
        key: z.uuid().parse(req.get('idempotency-key')),
        actor: actorFrom(res),
      }),
    );
  });
  router.get('/:kind/:id/date-corrections', web, async (req, res) => {
    const target = {
      kind: correctionKindSchema.parse(req.params.kind),
      id: correctionDocumentIdSchema.parse(req.params.id),
    };
    ok(res, await db.readSnapshot((tx) => readDateCorrections(tx, target)));
  });
  return router;
}
