import type { Request, Response } from 'express';
import { createMasterItemSchema, updateMasterItemSchema, masterItemSchema } from '@wms/contracts';
import type { Database } from '../../db/mysql.ts';
import { actorFrom, ok } from '../../middleware/http.ts';
import { idSchema } from '@wms/contracts';
import { parseCatalog } from './catalogs.ts';
import { createMasterItem, listMasterItems, readMasterItem, updateMasterItem } from './service.ts';

export function masterDataController(db: Database) {
  return {
    list: async (req: Request, res: Response): Promise<void> =>
      ok(res, await listMasterItems(db, parseCatalog(req.params.catalog), req.query)),
    read: async (req: Request, res: Response): Promise<void> =>
      ok(
        res,
        await readMasterItem(db, parseCatalog(req.params.catalog), masterItemSchema.shape.code.parse(req.params.code)),
      ),
    create: async (req: Request, res: Response): Promise<void> =>
      ok(
        res,
        await createMasterItem(
          db,
          parseCatalog(req.params.catalog),
          createMasterItemSchema.parse(req.body),
          actorFrom(res),
        ),
      ),
    update: async (req: Request, res: Response): Promise<void> =>
      ok(
        res,
        await updateMasterItem(
          db,
          parseCatalog(req.params.catalog),
          idSchema.parse(req.params.code),
          updateMasterItemSchema.parse(req.body),
          actorFrom(res),
        ),
      ),
  };
}
