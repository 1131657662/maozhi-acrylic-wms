import type { Request, Response } from 'express';
import { z } from 'zod';
import {
  createStocktakeSchema,
  saveReadingSchema,
  stocktakeQuerySchema,
  masterItemsSchema,
  stocktakeExportQuerySchema,
  publicStocktakePreviewSchema,
} from '@wms/contracts';
import type { Database } from '../../db/mysql.ts';
import { actorFrom, ok } from '../../middleware/http.ts';
import { createStocktake } from './create.ts';
import {
  publicStocktakeDetail,
  publicStocktakeList,
  publicStocktakeLines,
  publicReadingResult,
  publicStocktakePreview,
} from './public-read.ts';
import { saveReading } from './save-reading.ts';
import { voidStocktake } from './void.ts';
import { postStocktake } from './post.ts';
import { publicHeader } from './visibility.ts';
import { revealStocktake } from './reveal.ts';
import { exportStocktake } from './export.ts';

const id = (req: Request) => z.uuid().parse(req.params.id);
const key = (req: Request) => z.uuid().parse(req.get('idempotency-key'));
export function stocktakeController(db: Database) {
  return {
    post: async (req: Request, res: Response) =>
      ok(
        res,
        publicHeader(await postStocktake(db, { id: id(req), input: req.body, key: key(req), actor: actorFrom(res) })),
      ),
    void: async (req: Request, res: Response) =>
      ok(
        res,
        publicHeader(await voidStocktake(db, { id: id(req), input: req.body, key: key(req), actor: actorFrom(res) })),
      ),
    reveal: async (req: Request, res: Response) => {
      const result = await revealStocktake(db, { id: id(req), input: req.body, key: key(req), actor: actorFrom(res) });
      ok(res, publicStocktakePreviewSchema.parse({ ...result, stocktake: publicHeader(result.stocktake) }));
    },
    export: async (req: Request, res: Response) => {
      const query = stocktakeExportQuerySchema.parse(req.query);
      const result = await exportStocktake(db, id(req), query.kind);
      res.set('Cache-Control', 'private, no-store').attachment(result.filename).send(result.buffer);
    },
    products: async (req: Request, res: Response) => {
      const keyword = z.string().max(80).default('').parse(req.query.keyword);
      const rows = await db.all(
        `SELECT code,name,active FROM master_products WHERE inventory_eligible=1
        AND active=1 AND source_del_flag=0 AND (code LIKE ? OR name LIKE ?) ORDER BY code LIMIT 100`,
        [`%${keyword}%`, `%${keyword}%`],
      );
      ok(res, masterItemsSchema.parse(rows.map((r) => ({ ...r, active: Number(r.active) === 1 }))));
    },
    list: async (req: Request, res: Response) =>
      ok(res, await db.readSnapshot((tx) => publicStocktakeList(tx, stocktakeQuerySchema.parse(req.query)))),
    detail: async (req: Request, res: Response) =>
      ok(res, await db.readSnapshot((tx) => publicStocktakeDetail(tx, id(req), stocktakeQuerySchema.parse(req.query)))),
    lines: async (req: Request, res: Response) =>
      ok(res, await db.readSnapshot((tx) => publicStocktakeLines(tx, id(req), stocktakeQuerySchema.parse(req.query)))),
    preview: async (req: Request, res: Response) =>
      ok(res, await db.readSnapshot((tx) => publicStocktakePreview(tx, id(req)))),
    create: async (req: Request, res: Response) =>
      ok(res, publicHeader(await createStocktake(db, createStocktakeSchema.parse(req.body), key(req), actorFrom(res)))),
    save: async (req: Request, res: Response) =>
      ok(
        res,
        await publicReadingResult(
          db,
          id(req),
          await saveReading(db, {
            id: id(req),
            productCode: z.string().min(1).max(80).parse(req.params.product),
            input: saveReadingSchema.parse(req.body),
            key: key(req),
            actor: actorFrom(res),
          }),
        ),
      ),
  };
}
