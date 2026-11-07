import type { Request, Response } from 'express';
import { createInboundSchema, idSchema, inboundListQuerySchema, inboundListSchema, inboundReceiptSchema } from '@wms/contracts';
import { z } from 'zod';
import type { Database } from '../../db/mysql.ts';
import { actorFrom, ok } from '../../middleware/http.ts';
import { createInbound } from './create.ts';
import { getInbound, listInbound } from './repository.ts';

export function inboundController(db: Database) {
  return {
    list: async (req: Request, res: Response): Promise<void> => ok(res,
      inboundListSchema.parse(await listInbound(db, inboundListQuerySchema.parse(req.query)))),
    detail: async (req: Request, res: Response): Promise<void> => ok(res,
      inboundReceiptSchema.parse(await getInbound(db, idSchema.parse(req.params.id)))),
    create: async (req: Request, res: Response): Promise<void> => ok(res,
      await createInbound(db, createInboundSchema.parse(req.body), z.uuid().parse(req.get('idempotency-key')), actorFrom(res))),
  };
}
