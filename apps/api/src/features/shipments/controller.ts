import type { Request, Response } from 'express';
import { z } from 'zod';
import { idSchema } from '@wms/contracts';
import type { Database } from '../../db/mysql.ts';
import { actorFrom, ok } from '../../middleware/http.ts';
import { confirmShipment } from './create.ts';
import { completeShipment } from './complete.ts';
import { shortCloseShipment } from './short-close.ts';
import { editShipmentPlan } from './plan.ts';
import { shipmentList } from './read.ts';

function command(req: Request, res: Response) {
  return {
    id: idSchema.parse(req.params.id),
    input: req.body,
    key: z.uuid().parse(req.get('idempotency-key')),
    actor: actorFrom(res),
  };
}
export function shipmentController(db: Database) {
  return {
    list: async (req: Request, res: Response) => {
      z.strictObject({}).parse(req.query);
      ok(res, await shipmentList(db, idSchema.parse(req.params.id)));
    },
    create: async (req: Request, res: Response) => ok(res, await confirmShipment(db, command(req, res))),
    complete: async (req: Request, res: Response) => ok(res, await completeShipment(db, command(req, res))),
    shortClose: async (req: Request, res: Response) => ok(res, await shortCloseShipment(db, command(req, res))),
    plan: async (req: Request, res: Response) => ok(res, await editShipmentPlan(db, command(req, res))),
  };
}
