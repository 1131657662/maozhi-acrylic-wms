import express from 'express';
import { z } from 'zod';
import {
  catalogBarcodeQuerySchema,
  catalogPublishInputSchema,
  catalogSearchQuerySchema,
  idSchema,
  sessionSchema,
} from '@wms/contracts';
import type { Database } from '../../db/mysql.ts';
import { actorFrom, ok, requireChannel } from '../../middleware/http.ts';
import { AppError } from '../../shared/errors.ts';
import { uploadCatalog } from './upload.ts';
import { publishCatalog } from './publish.ts';
import { history } from './repository.ts';
import { overview, uploadResult, versionDiff, manifest, versionEntries } from './read.ts';
import { lookupCatalogBarcode, searchCatalog, summarizeCatalogSpecs, traceCatalogBarcode } from './query.ts';
import { factContexts } from '../scan/notices.ts';

const uploadQuery = z.object({
  encoding: z.enum(['utf-8', 'gb18030']),
  fileName: z
    .string()
    .min(1)
    .max(255)
    .regex(/^[^/\\]+\.txt$/i),
  rebuildOfVersionId: z.coerce.number().int().positive().optional(),
});
const paging = z.object({
  afterBarcode: z.string().max(80).default(''),
  limit: z.coerce.number().int().min(1).max(1000).default(50),
});
const versionId = z.coerce.number().int().positive();
export function catalogRouter(db: Database, origins: string[], enabled: boolean): express.Router {
  const router = express.Router();
  const web = requireChannel('web', origins);
  router.get('/catalog', web, async (_req, res) => ok(res, await overview(db, enabled)));
  router.get('/catalog/search', web, async (req, res) =>
    ok(res, await searchCatalog(db, catalogSearchQuerySchema.parse(req.query))),
  );
  router.get('/catalog/spec-summary', web, async (_req, res) => ok(res, await summarizeCatalogSpecs(db)));
  router.get('/catalog/barcode-trace', web, async (req, res) => {
    const { barcode } = catalogBarcodeQuerySchema.parse(req.query);
    ok(res, await traceCatalogBarcode(db, barcode));
  });
  router.get('/catalog/lookup', web, async (req, res) => {
    const { barcode } = catalogBarcodeQuerySchema.parse(req.query);
    ok(res, await lookupCatalogBarcode(db, barcode));
  });
  router.get('/catalog/versions', web, async (req, res) =>
    ok(res, await history(db, z.coerce.number().int().min(1).default(1).parse(req.query.page))),
  );
  router.post(
    '/catalog/uploads',
    web,
    express.raw({ type: 'application/octet-stream', limit: '5mb' }),
    async (req, res) => {
      const query = uploadQuery.parse(req.query);
      if (!Buffer.isBuffer(req.body)) throw new AppError('CATALOG_FILE_INVALID', '请选择完整的 txt 文件', 422);
      ok(
        res,
        await uploadCatalog(db, {
          ...query,
          bytes: req.body,
          key: z.uuid().parse(req.get('Idempotency-Key')),
          actor: actorFrom(res),
        }),
      );
    },
  );
  router.get('/catalog/uploads/:id', web, async (req, res) =>
    ok(res, await uploadResult(db, z.uuid().parse(req.params.id), actorFrom(res).username)),
  );
  router.get('/catalog/versions/:versionId/diff', web, async (req, res) => {
    const p = paging.parse(req.query);
    const kind = z
      .enum(['all', 'added', 'removed', 'weight', 'spec', 'unchanged', 'changed'])
      .default('all')
      .parse(req.query.kind);
    ok(
      res,
      await versionDiff(db, {
        versionId: versionId.parse(req.params.versionId),
        kind,
        after: p.afterBarcode,
        limit: p.limit,
      }),
    );
  });
  router.post('/catalog/versions/:versionId/publish', web, async (req, res) =>
    ok(
      res,
      await publishCatalog(db, {
        ...catalogPublishInputSchema.parse(req.body),
        versionId: versionId.parse(req.params.versionId),
        key: z.uuid().parse(req.get('Idempotency-Key')),
        actor: actorFrom(res),
        enabled,
      }),
    ),
  );
  attachReaders(router, db);
  return router;
}
function attachReaders(router: express.Router, db: Database): void {
  const read: express.RequestHandler = (_req, res, next) => {
    if (sessionSchema.parse(res.locals.session).channel === 'miniapp')
      throw new AppError('CLIENT_NOT_ALLOWED', '小程序不提供条码目录管理', 403);
    next();
  };
  router.get('/scan/catalog/manifest', read, async (_req, res) => ok(res, await manifest(db)));
  router.get('/scan/catalog/versions/:versionId/entries', read, async (req, res) => {
    const p = paging.parse(req.query);
    ok(
      res,
      await versionEntries(db, {
        versionId: versionId.parse(req.params.versionId),
        after: p.afterBarcode,
        limit: p.limit,
      }),
    );
  });
  router.get('/scan/plans/:id/fact-contexts', read, async (req, res) =>
    ok(
      res,
      await factContexts(
        db,
        idSchema.parse(req.params.id),
        z.string().max(36).default('').parse(req.query.afterFactId),
      ),
    ),
  );
}
