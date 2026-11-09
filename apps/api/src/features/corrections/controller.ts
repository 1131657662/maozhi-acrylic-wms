import type { Request, Response } from 'express';
import { z } from 'zod';
import { correctionInputSchema, correctionKindSchema, idSchema } from '@wms/contracts';
import type { Database } from '../../db/mysql.ts';
import { actorFrom, ok } from '../../middleware/http.ts';
import { createCorrection } from './create.ts';
import { readCorrection, readCorrections } from './read.ts';
import { changeBusinessDate } from '../business-date/change.ts';

function target(req: Request) {
  return { kind: correctionKindSchema.parse(req.params.kind), id: idSchema.parse(req.params.id) };
}
export function correctionController(db: Database) {
  return {
    create: async (req: Request, res: Response) =>
      ok(
        res,
        await createCorrection(db, {
          ...target(req),
          input: correctionInputSchema.parse(req.body),
          key: z.uuid().parse(req.get('idempotency-key')),
          actor: actorFrom(res),
        }),
      ),
    list: async (req: Request, res: Response) =>
      ok(res, await db.readSnapshot((tx) => readCorrections(tx, target(req)))),
    detail: async (req: Request, res: Response) =>
      ok(res, await db.readSnapshot((tx) => readCorrection(tx, z.uuid().parse(req.params.id)))),
    date: async (req: Request, res: Response) =>
      ok(
        res,
        await changeBusinessDate(db, {
          ...target(req),
          input: req.body,
          key: z.uuid().parse(req.get('idempotency-key')),
          actor: actorFrom(res),
        }),
      ),
  };
}
