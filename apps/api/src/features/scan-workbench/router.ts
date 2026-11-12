import { Router } from 'express';
import { z } from 'zod';
import { idSchema, scanRecordInputSchema, scanBatchInputSchema, scanCandidateQuerySchema } from '@wms/contracts';
import type { Database } from '../../db/mysql.ts';
import { actorFrom, ok, requireChannel } from '../../middleware/http.ts';
import { addScanRecord } from './record.ts';
import { addScanBatch } from './batch.ts';
import { revokeScanRecord } from './revoke.ts';
import { scanCandidates, scanSummary } from './queries.ts';

export function scanWorkbenchRouter(db: Database, origins: string[]) {
  const router = Router();
  const web = requireChannel('web', origins);
  router.get('/outbound/:id/scan-candidates', web, async (req, res) => {
    ok(res, await scanCandidates(db, idSchema.parse(req.params.id), scanCandidateQuerySchema.parse(req.query)));
  });
  router.get('/outbound/:id/scan-summary', web, async (req, res) => {
    z.strictObject({}).parse(req.query);
    ok(res, await scanSummary(db, idSchema.parse(req.params.id)));
  });
  router.post('/outbound/:id/scan-records', web, async (req, res) => {
    ok(
      res,
      await addScanRecord(
        db,
        idSchema.parse(req.params.id),
        scanRecordInputSchema.parse(req.body),
        z.uuid().parse(req.get('idempotency-key')),
        actorFrom(res),
      ),
    );
  });
  router.post('/outbound/:id/scan-records/batch', web, async (req, res) => {
    ok(
      res,
      await addScanBatch(
        db,
        idSchema.parse(req.params.id),
        scanBatchInputSchema.parse(req.body),
        z.uuid().parse(req.get('idempotency-key')),
        actorFrom(res),
      ),
    );
  });
  router.delete('/outbound/:id/scan-records/:recordId', web, async (req, res) => {
    ok(
      res,
      await revokeScanRecord(
        db,
        idSchema.parse(req.params.id),
        z.uuid().parse(req.params.recordId),
        z.uuid().parse(req.get('idempotency-key')),
        actorFrom(res),
      ),
    );
  });
  return router;
}
