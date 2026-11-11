import { z } from 'zod';
import type { Database } from '../../db/mysql.ts';
import { ok } from '../../middleware/http.ts';
import type { RequestHandler } from 'express';
import { webInboundQuerySchema, webOutboundQuerySchema, webStockQuerySchema } from '@wms/contracts';
import { listWebInbound } from './inbound.ts';
import { listWebOutbound } from './outbound.ts';
import { listWebStock } from './stock.ts';
import { listWebStatuses } from './statuses.ts';

export function webListController(db: Database): Record<'inbound' | 'outbound' | 'stock' | 'statuses', RequestHandler> {
  return {
    inbound: async (req, res) => ok(res, await listWebInbound(db, webInboundQuerySchema.parse(req.query))),
    outbound: async (req, res) => ok(res, await listWebOutbound(db, webOutboundQuerySchema.parse(req.query))),
    stock: async (req, res) => ok(res, await listWebStock(db, webStockQuerySchema.parse(req.query))),
    statuses: async (req, res) => {
      const kind = z.enum(['inbound', 'outbound']).parse(req.params.kind);
      ok(res, await listWebStatuses(db, kind));
    },
  };
}
