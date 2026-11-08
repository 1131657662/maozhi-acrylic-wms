import { Router } from 'express';
import { z } from 'zod';
import { handoffStartSchema, handoffBatchSchema, handoffBindSchema } from '@wms/contracts';
import type { Database } from '../../db/mysql.ts';
import { ok, requireChannel, actorFrom, tokenFrom } from '../../middleware/http.ts';
import { ensure } from '../../shared/errors.ts';
import { hash } from '../../shared/hash.ts';
import { startHandoff, checkHandoffDevice } from './start.ts';
import { registerRecords } from './records.ts';
import { handoffDetail, handoffOverview } from './read.ts';
import { bindRecords } from './bind.ts';
import { confirmHandoff, linkClient } from './confirm.ts';

export function handoffRouter(db: Database, origins: string[]): Router {
  const router = Router(),
    web = requireChannel('web', origins),
    pda = requireChannel('pda', origins);
  router.post('/scan/handoffs', pda, async (req, res) => {
    const input = handoffStartSchema.parse(req.body);
    ensure(input.deviceId === req.get('X-Device-Id'), 'HANDOFF_DEVICE_MISMATCH', '设备标识不一致');
    input.previousSessionHashes = [...new Set([...input.previousSessionHashes, hash(tokenFrom(req))])];
    ok(res, await startHandoff(db, input, actorFrom(res)));
  });
  router.use('/scan/handoffs/:id', pda, async (req, _res, next) => {
    await checkHandoffDevice(db, z.uuid().parse(req.params.id), z.string().min(1).parse(req.get('X-Device-Id')));
    next();
  });
  router.post('/scan/handoffs/:id/records', async (req, res) =>
    ok(res, await registerRecords(db, z.uuid().parse(req.params.id), handoffBatchSchema.parse(req.body).records)),
  );
  router.get('/scan/handoffs/:id', async (req, res) =>
    ok(
      res,
      await handoffDetail(
        db,
        z.uuid().parse(req.params.id),
        z.coerce.number().int().min(1).default(1).parse(req.query.page),
      ),
    ),
  );
  router.get('/catalog/handoffs', web, async (_req, res) => ok(res, await handoffOverview(db)));
  router.get('/catalog/handoffs/:id', web, async (req, res) =>
    ok(
      res,
      await handoffDetail(
        db,
        z.uuid().parse(req.params.id),
        z.coerce.number().int().min(1).default(1).parse(req.query.page),
      ),
    ),
  );
  router.post('/catalog/handoffs/:id/bind', web, async (req, res) => {
    const b = handoffBindSchema.parse(req.body);
    ok(res, await bindRecords(db, z.uuid().parse(req.params.id), b.factIds, b.outboundLineId, actorFrom(res)));
  });
  router.post('/catalog/handoffs/:id/clients', web, async (req, res) =>
    ok(
      res,
      await linkClient(
        db,
        z.uuid().parse(req.params.id),
        z
          .string()
          .regex(/^(device|session):[a-zA-Z0-9-]+$/)
          .max(100)
          .parse(req.body.clientKey),
        actorFrom(res),
      ),
    ),
  );
  router.post('/catalog/handoffs/:id/confirm', web, async (req, res) =>
    ok(res, await confirmHandoff(db, z.uuid().parse(req.params.id), actorFrom(res))),
  );
  return router;
}
