import type { RequestHandler } from 'express';
import type { Database } from '../../db/mysql.ts';
import { authenticate } from '../auth/service.ts';
import { identifyAuditActor } from '../audit/context.ts';
import { tokenFrom } from '../../middleware/http.ts';
import { AppError } from '../../shared/errors.ts';
import { maintenanceErrors as copy } from './copy.ts';

export function maintenanceAuth(db: Database): RequestHandler {
  return async (req, res, next) => {
    try {
      res.locals.session = await authenticate(db, tokenFrom(req));
    } catch (error) {
      if (error instanceof AppError) throw error;
      throw new AppError('MAINTENANCE_DATABASE_UNAVAILABLE', copy.database, 503);
    }
    identifyAuditActor({ ...res.locals.session, traceId: String(res.locals.traceId) });
    next();
  };
}
