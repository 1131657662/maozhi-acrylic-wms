import type { Request,Response } from 'express';
import type { Database } from '../../db/mysql.ts';
import { z } from 'zod';
import { factInputSchema,idSchema,revisionSchema } from '@wms/contracts';
import { recordFact } from './service.ts';
import { freezePlan } from './freeze.ts';
import { listCatalog } from './catalog.ts';
import { actorFrom,ok } from '../../middleware/http.ts';

export function scanController(db:Database) {
  return {
    catalog:async(_req:Request,res:Response):Promise<void> => ok(res,await listCatalog(db)),
    fact:async(req:Request,res:Response):Promise<void> => ok(res,await recordFact(db,{
      planId:idSchema.parse(req.params.id),fact:factInputSchema.parse(req.body),actor:actorFrom(res),
    })),
    freeze:async(req:Request,res:Response):Promise<void> => ok(res,await freezePlan(db,{
      planId:idSchema.parse(req.params.id),key:z.uuid().parse(req.get('idempotency-key')),
      expected:revisionSchema.parse(req.body),actor:actorFrom(res),
    })),
  };
}
