import type { Request, Response } from 'express';
import {
  confirmInboundSchema,
  createInboundSchema,
  idSchema,
  inboundListQuerySchema,
  inboundListSchema,
  inboundReceiptSchema,
} from '@wms/contracts';
import { z } from 'zod';
import type { Database } from '../../db/mysql.ts';
import { actorFrom, ok } from '../../middleware/http.ts';
import { createInbound } from './create.ts';
import { getInbound, listInbound } from './repository.ts';
import { legacyNumberHeaders } from '../document-numbering/compatibility.ts';
import { confirmInbound } from './confirm.ts';

export function inboundController(db: Database) {
  return {
    confirm: async (req: Request, res: Response): Promise<void> => {
      confirmInboundSchema.parse(req.body);
      ok(
        res,
        await confirmInbound(
          db,
          idSchema.parse(req.params.id),
          z.uuid().parse(req.get('idempotency-key')),
          actorFrom(res),
        ),
      );
    },
    list: async (req: Request, res: Response): Promise<void> =>
      ok(res, inboundListSchema.parse(await listInbound(db, inboundListQuerySchema.parse(req.query)))),
    detail: async (req: Request, res: Response): Promise<void> =>
      ok(res, inboundReceiptSchema.parse(await getInbound(db, idSchema.parse(req.params.id)))),
    create: async (req: Request, res: Response): Promise<void> => {
      const input = createInboundSchema.parse(req.body);
      legacyNumberHeaders(res, input.receiptNo);
      ok(res, await createInbound(db, input, z.uuid().parse(req.get('idempotency-key')), actorFrom(res)));
    },
  };
}
