import { z } from 'zod';
import type { Router, RequestHandler } from 'express';
import { catalogAbandonInputSchema, catalogHandoffQuerySchema } from '@wms/contracts';
import type { Database } from '../../db/mysql.ts';
import { actorFrom, ok } from '../../middleware/http.ts';
import { abandonCandidate } from './abandon.ts';
import { rebuildCandidate } from './rebuild.ts';
import { candidateHandoffs } from './candidate-handoffs.ts';
import { getVersion } from './repository.ts';

const versionId = z.coerce.number().int().positive();
export function attachCandidateRoutes(router: Router, db: Database, web: RequestHandler): void {
  attachCandidateReads(router, db, web);
  attachCandidateCommands(router, db, web);
}
function attachCandidateReads(router: Router, db: Database, web: RequestHandler): void {
  router.get('/catalog/versions/:id', web, async (req, res) =>
    ok(res, await getVersion(db, versionId.parse(req.params.id))),
  );
  router.get('/catalog/versions/:id/handoffs', web, async (req, res) =>
    ok(
      res,
      await candidateHandoffs(db, {
        versionId: versionId.parse(req.params.id),
        ...catalogHandoffQuerySchema.parse(req.query),
      }),
    ),
  );
}
function attachCandidateCommands(router: Router, db: Database, web: RequestHandler): void {
  router.post('/catalog/versions/:id/abandon', web, async (req, res) =>
    ok(
      res,
      await abandonCandidate(db, {
        ...catalogAbandonInputSchema.parse(req.body),
        versionId: versionId.parse(req.params.id),
        key: z.uuid().parse(req.get('Idempotency-Key')),
        actor: actorFrom(res),
      }),
    ),
  );
  router.post('/catalog/versions/:id/rebuild', web, async (req, res) => {
    z.strictObject({}).parse(req.body);
    ok(
      res,
      await rebuildCandidate(db, {
        versionId: versionId.parse(req.params.id),
        key: z.uuid().parse(req.get('Idempotency-Key')),
        actor: actorFrom(res),
      }),
    );
  });
}
