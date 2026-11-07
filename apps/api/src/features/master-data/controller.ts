import type { Request, Response } from 'express';
import { createMasterItemSchema, updateMasterItemSchema } from '@wms/contracts';
import type { Database } from '../../db/mysql.ts';
import { actorFrom, ok } from '../../middleware/http.ts';
import { idSchema } from '@wms/contracts';
import { parseCatalog } from './catalogs.ts';
import { createMasterItem, listMasterItems, updateMasterItem } from './service.ts';

export function masterDataController(db: Database) {
  return {
    list: async (req: Request, res: Response): Promise<void> => ok(res,
      await listMasterItems(db, parseCatalog(req.params.catalog))),
    create: async (req: Request, res: Response): Promise<void> => ok(res,
      await createMasterItem(db, parseCatalog(req.params.catalog), createMasterItemSchema.parse(req.body), actorFrom(res))),
    update: async (req: Request, res: Response): Promise<void> => ok(res,
      await updateMasterItem(db, parseCatalog(req.params.catalog), idSchema.parse(req.params.code),
        updateMasterItemSchema.parse(req.body), actorFrom(res))),
  };
}
