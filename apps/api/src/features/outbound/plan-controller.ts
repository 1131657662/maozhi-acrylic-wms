import type { Request, Response } from 'express';
import { createOutboundPlanSchema, detailSchema, idSchema } from '@wms/contracts';
import { z } from 'zod';
import type { Database } from '../../db/mysql.ts';
import { actorFrom, ok } from '../../middleware/http.ts';
import { createOutboundPlan, editOutboundPlan } from './plans.ts';

export function outboundPlanController(db: Database) {
  return {
    create: async (req: Request, res: Response): Promise<void> => ok(res,
      detailSchema.parse(await createOutboundPlan(db, createOutboundPlanSchema.parse(req.body),
        z.uuid().parse(req.get('idempotency-key')), actorFrom(res)))),
    edit: async (req: Request, res: Response): Promise<void> => ok(res,
      detailSchema.parse(await editOutboundPlan(db, idSchema.parse(req.params.id), req.body,
        z.uuid().parse(req.get('idempotency-key')), actorFrom(res)))),
  };
}
