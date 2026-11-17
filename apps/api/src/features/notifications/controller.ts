import { z } from 'zod';
import { messageQuerySchema } from '@wms/contracts';
import type { RequestHandler } from 'express';
import type { Database } from '../../db/mysql.ts';
import { actorFrom, ok } from '../../middleware/http.ts';
import { listMessages, unreadCount } from './read.ts';
import { markRead } from './mark-read.ts';

export function messageController(db: Database): Record<'list' | 'count' | 'read' | 'readAll', RequestHandler> {
  return {
    list: async (req, res) => ok(res, await listMessages(db, messageQuerySchema.parse(req.query))),
    count: async (req, res) => {
      z.strictObject({}).parse(req.query);
      ok(res, await unreadCount(db));
    },
    read: async (req, res) => {
      z.strictObject({}).parse(req.body ?? {});
      ok(res, await markRead(db, actorFrom(res), z.uuid().parse(req.params.id)));
    },
    readAll: async (req, res) => {
      z.strictObject({}).parse(req.body ?? {});
      ok(res, await markRead(db, actorFrom(res)));
    },
  };
}
