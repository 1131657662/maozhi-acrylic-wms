import type { Request, Response } from 'express';
import { sourceJournalQuerySchema, stockSourceQuerySchema } from '@wms/contracts';
import type { Database } from '../../db/mysql.ts';
import { ok } from '../../middleware/http.ts';
import { readSourceJournal, readSourceStock } from './source-service.ts';

export function stockSourceController(db: Database) {
  return {
    stock: async (req: Request, res: Response) => {
      const { source, scope } = stockSourceQuerySchema.parse(req.query);
      ok(res, await readSourceStock(db, scope ?? source!));
    },
    journal: async (req: Request, res: Response) => {
      const { source, scope, limit } = sourceJournalQuerySchema.parse(req.query);
      ok(res, await readSourceJournal(db, scope ?? source!, limit));
    },
  };
}
