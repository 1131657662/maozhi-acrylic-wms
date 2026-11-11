import type { Request, Response } from 'express';
import type { Database } from '../../db/mysql.ts';
import {
  idSchema,
  listQuerySchema,
  listSchema,
  confirmOutboundSchema,
  sessionSchema,
  outboundPrefillSchema,
} from '@wms/contracts';
import { z } from 'zod';
import { getOrder, listOrders } from './repository.ts';
import { confirmOutbound } from './confirm.ts';
import { actorFrom, ok } from '../../middleware/http.ts';
import { exportScanRecords } from './scan-export.ts';
import { pdaScanProjection } from '../scan/projection.ts';
import { exposePlans } from './exposure.ts';

export function outboundController(db: Database) {
  return {
    list: async (req: Request, res: Response): Promise<void> => {
      const query = listQuerySchema.parse(req.query);
      const result =
        sessionSchema.parse(res.locals.session).channel === 'pda'
          ? await exposePlans(db, async (tx) => {
              const result = await listOrders(tx, query);
              return {
                result: { ...result, items: result.items.map(pdaScanProjection) },
                ids: result.items.map((i) => i.id),
              };
            })
          : await listOrders(db, query);
      ok(res, listSchema.parse(result));
    },
    detail: async (req: Request, res: Response): Promise<void> => {
      const id = idSchema.parse(req.params.id);
      ok(
        res,
        sessionSchema.parse(res.locals.session).channel === 'pda'
          ? await exposePlans(db, async (tx) => ({ result: pdaScanProjection(await getOrder(tx, id)), ids: [id] }))
          : await getOrder(db, id),
      );
    },
    scanExport: async (req: Request, res: Response): Promise<void> => {
      const result = await exportScanRecords(db, idSchema.parse(req.params.id));
      res
        .set('Cache-Control', 'no-store')
        .attachment(result.filename)
        .type('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
        .send(result.buffer);
    },
    prefill: async (req: Request, res: Response): Promise<void> => {
      const order = await getOrder(db, idSchema.parse(req.params.id));
      ok(
        res,
        outboundPrefillSchema.parse({
          id: order.id,
          revision: order.revision,
          digest: order.digest,
          lines: order.lines.map((line) => ({
            lineId: line.id,
            scanPackages: line.scanPackages ?? 0,
            scanWeightGrams: line.scanWeightGrams ?? 0,
          })),
        }),
      );
    },
    confirm: async (req: Request, res: Response): Promise<void> => {
      const input = confirmOutboundSchema.parse(req.body);
      ok(
        res,
        await confirmOutbound(db, {
          planId: idSchema.parse(req.params.id),
          key: z.uuid().parse(req.get('idempotency-key')),
          expected: { revision: input.revision, digest: input.digest },
          lines: input.lines,
          actor: actorFrom(res),
        }),
      );
    },
  };
}
