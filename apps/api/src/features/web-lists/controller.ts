import { z } from 'zod';
import type { Database } from '../../db/mysql.ts';
import { ok } from '../../middleware/http.ts';
import type { RequestHandler } from 'express';
import {
  webInboundQuerySchema,
  webOutboundQuerySchema,
  webStockQuerySchema,
  webAuditQuerySchema,
} from '@wms/contracts';
import { listWebInbound } from './inbound.ts';
import { listWebOutbound } from './outbound.ts';
import { listWebStock } from './stock.ts';
import { listWebAudit, readWebAudit } from './audit.ts';
import { listWebStatuses } from './statuses.ts';

export function webListController(
  db: Database,
): Record<'inbound' | 'outbound' | 'stock' | 'audit' | 'auditDetail' | 'statuses', RequestHandler> {
  return {
    inbound: async (req, res) => ok(res, await listWebInbound(db, webInboundQuerySchema.parse(req.query))),
    outbound: async (req, res) => ok(res, await listWebOutbound(db, webOutboundQuerySchema.parse(req.query))),
    stock: async (req, res) => ok(res, await listWebStock(db, webStockQuerySchema.parse(req.query))),
    audit: async (req, res) => ok(res, await listWebAudit(db, webAuditQuerySchema.parse(req.query))),
    auditDetail: async (req, res) =>
      ok(res, await readWebAudit(db, z.coerce.number().int().positive().parse(req.params.id))),
    statuses: async (req, res) => {
      const kind = z.enum(['inbound', 'outbound']).parse(req.params.kind);
      ok(res, await listWebStatuses(db, kind));
    },
  };
}
