import { Router, type Response } from 'express';
import { z } from 'zod';
import {
  webAuditQuerySchema,
  auditCursorQuerySchema as cursorQuery,
  auditRawQuerySchema as rawQuery,
  auditObjectNames,
} from '@wms/contracts';
import type { Database } from '../../db/mysql.ts';
import { requireChannel } from '../../middleware/http.ts';
import { listWebAudit } from '../web-lists/audit.ts';
import { auditId, auditRecord } from './records.ts';
import { readWebAudit, relatedEvents } from './detail.ts';
import { readRaw, traceDiagnostic } from './raw.ts';
import { auditTimeline, objectEvents } from './timeline.ts';
export function auditOk(res: Response, data: unknown): void {
  res.set('Cache-Control', 'private, no-store');
  res.json({ code: 'OK', message: '成功', data });
}
export function auditRouter(db: Database, origins: string[]): Router {
  const router = Router();
  router.use(requireChannel('web', origins), (_req, res, next) => {
    res.set('Cache-Control', 'private, no-store');
    next();
  });
  router.get('/', async (req, res) => auditOk(res, await listWebAudit(db, webAuditQuerySchema.parse(req.query))));
  router.get('/timeline', async (req, res) =>
    auditOk(res, await auditTimeline(db, webAuditQuerySchema.parse(req.query))),
  );
  router.get('/objects/:kind/:targetId', async (req, res) => {
    const kind = z
      .string()
      .refine((value) => Object.hasOwn(auditObjectNames, value))
      .parse(req.params.kind);
    auditOk(
      res,
      await objectEvents(
        db,
        kind,
        z.string().min(1).max(100).parse(req.params.targetId),
        cursorQuery.parse(req.query).cursor,
      ),
    );
  });
  router.get('/:id/events', async (req, res) => {
    const row = await auditRecord(db, auditId(req.params.id));
    auditOk(
      res,
      row.target_kind && row.target_id
        ? await objectEvents(db, String(row.target_kind), String(row.target_id), cursorQuery.parse(req.query).cursor)
        : { items: [], total: 0, nextCursor: null },
    );
  });
  router.get('/:id/related', async (req, res) =>
    auditOk(res, await relatedEvents(db, auditId(req.params.id), cursorQuery.parse(req.query).cursor)),
  );
  router.get('/:id/raw', async (req, res) =>
    auditOk(res, await readRaw(db, auditId(req.params.id), rawQuery.parse(req.query))),
  );
  router.get('/:id/trace.json', async (req, res) => {
    z.strictObject({}).parse(req.query);
    const abort = new AbortController();
    res.once('close', () => abort.abort());
    const bytes = await traceDiagnostic(db, auditId(req.params.id), abort.signal);
    if (!res.destroyed) res.type('application/json').attachment('audit-diagnostic.json').send(bytes);
  });
  router.get('/:id', async (req, res) => auditOk(res, await readWebAudit(db, auditId(req.params.id))));
  return router;
}
