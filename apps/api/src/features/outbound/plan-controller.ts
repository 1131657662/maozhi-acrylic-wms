import type { Request, Response } from 'express';
import { createOutboundPlanSchema, editOutboundPlanSchema, detailSchema, idSchema } from '@wms/contracts';
import { z } from 'zod';
import type { Database } from '../../db/mysql.ts';
import { actorFrom, ok } from '../../middleware/http.ts';
import { createOutboundPlan, editOutboundPlan } from './plans.ts';
import { legacyNumberHeaders } from '../document-numbering/compatibility.ts';

export function outboundPlanController(db: Database) {
  return {
    create: async (req: Request, res: Response): Promise<void> => {
      const input = createOutboundPlanSchema.parse(req.body);
      legacyNumberHeaders(res, input.orderNo);
      ok(res, detailSchema.parse(await createOutboundPlan(db, input,
        z.uuid().parse(req.get('idempotency-key')), actorFrom(res))));
    },
    edit: async (req: Request, res: Response): Promise<void> => {
      const input = editOutboundPlanSchema.parse(req.body);
      legacyNumberHeaders(res, input.plan.orderNo);
      ok(res, detailSchema.parse(await editOutboundPlan(db, idSchema.parse(req.params.id), input,
        z.uuid().parse(req.get('idempotency-key')), actorFrom(res))));
    },
  };
}
