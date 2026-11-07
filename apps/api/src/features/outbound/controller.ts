import type { Request,Response } from 'express';
import type { Database } from '../../db/mysql.ts';
import { idSchema,listQuerySchema,listSchema,revisionSchema } from '@wms/contracts';
import { z } from 'zod';
import { getOrder,listOrders } from './repository.ts';
import { confirmOutbound } from './confirm.ts';
import { actorFrom,ok } from '../../middleware/http.ts';

export function outboundController(db:Database) {
  return {
    list:async(req:Request,res:Response):Promise<void> =>
      ok(res,listSchema.parse(await listOrders(db,listQuerySchema.parse(req.query)))),
    detail:async(req:Request,res:Response):Promise<void> => ok(res,await getOrder(db,idSchema.parse(req.params.id))),
    confirm:async(req:Request,res:Response):Promise<void> => ok(res,await confirmOutbound(db,{
      planId:idSchema.parse(req.params.id),key:z.uuid().parse(req.get('idempotency-key')),
      expected:revisionSchema.parse(req.body),actor:actorFrom(res),
    })),
  };
}
