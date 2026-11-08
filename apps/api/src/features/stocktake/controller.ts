import type { Request, Response } from 'express';
import { z } from 'zod';
import { createStocktakeSchema, saveReadingSchema, stocktakeQuerySchema, masterItemsSchema } from '@wms/contracts';
import type { Database } from '../../db/mysql.ts';
import { actorFrom, ok } from '../../middleware/http.ts';
import { createStocktake } from './create.ts';
import { getStocktake, listStocktakes, stocktakeLines } from './read-model.ts';
import { saveReading } from './save-reading.ts';
import { stocktakePreview } from './preview.ts';
import { voidStocktake } from './void.ts';
import { postStocktake } from './post.ts';

const id = (req: Request) => z.uuid().parse(req.params.id);
const key = (req: Request) => z.uuid().parse(req.get('idempotency-key'));
export function stocktakeController(db: Database) {
  return {
    post: async (req: Request, res: Response) =>
      ok(res, await postStocktake(db, { id: id(req), input: req.body, key: key(req), actor: actorFrom(res) })),
    void: async (req: Request, res: Response) =>
      ok(res, await voidStocktake(db, { id: id(req), input: req.body, key: key(req), actor: actorFrom(res) })),
    products: async (req: Request, res: Response) => {
      const keyword = z.string().max(80).default('').parse(req.query.keyword);
      const rows = await db.all(
        `SELECT code,name,active FROM master_products WHERE source_kind='erp-product'
        AND source_del_flag=0 AND (code LIKE ? OR name LIKE ?) ORDER BY code LIMIT 100`,
        [`%${keyword}%`, `%${keyword}%`],
      );
      ok(res, masterItemsSchema.parse(rows.map((r) => ({ ...r, active: Number(r.active) === 1 }))));
    },
    list: async (req: Request, res: Response) =>
      ok(res, await db.readSnapshot((tx) => listStocktakes(tx, stocktakeQuerySchema.parse(req.query)))),
    detail: async (req: Request, res: Response) => ok(res, await db.readSnapshot((tx) => getStocktake(tx, id(req)))),
    lines: async (req: Request, res: Response) =>
      ok(res, await db.readSnapshot((tx) => stocktakeLines(tx, id(req), stocktakeQuerySchema.parse(req.query)))),
    preview: async (req: Request, res: Response) =>
      ok(res, await db.readSnapshot((tx) => stocktakePreview(tx, id(req)))),
    create: async (req: Request, res: Response) =>
      ok(res, await createStocktake(db, createStocktakeSchema.parse(req.body), key(req), actorFrom(res))),
    save: async (req: Request, res: Response) =>
      ok(
        res,
        await saveReading(db, {
          id: id(req),
          productCode: z.string().min(1).max(80).parse(req.params.product),
          input: saveReadingSchema.parse(req.body),
          key: key(req),
          actor: actorFrom(res),
        }),
      ),
  };
}
