import type { Request, Response } from 'express';
import { z } from 'zod';
import { exportKindSchema, listPreferencesInputSchema } from '@wms/contracts';
import type { Database } from '../../db/mysql.ts';
import { actorFrom, ok } from '../../middleware/http.ts';
import { readPreferences, savePreferences } from './service.ts';

export function preferencesController(db: Database) {
  return {
    read: async (req: Request, res: Response) => {
      z.strictObject({}).parse(req.query);
      ok(res, await readPreferences(db, actorFrom(res).username, exportKindSchema.parse(req.params.kind)));
    },
    save: async (req: Request, res: Response) => {
      z.strictObject({}).parse(req.query);
      ok(
        res,
        await savePreferences(db, {
          user: actorFrom(res).username,
          kind: exportKindSchema.parse(req.params.kind),
          input: listPreferencesInputSchema.parse(req.body),
        }),
      );
    },
  };
}
