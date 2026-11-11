import type { RequestHandler, ErrorRequestHandler } from 'express';
import type { Database } from '../../db/mysql.ts';
import { auditContext, newAttempt } from './context.ts';
import { auditRoute } from './route-target.ts';
import { recordFailedAttempt } from './attempts.ts';

// Installed after server-generated trace and BEFORE body parsing/authentication.
export const beginAuditRequest: RequestHandler = (req, res, next) => {
  const context = newAttempt(auditRoute(req.method, req.path), String(res.locals.traceId));
  auditContext.run(context, next);
};
export function retainRequestFailure(db: Database): ErrorRequestHandler {
  return async (error: unknown, req, _res, next) => {
    const context = auditContext.getStore();
    if (context) {
      context.input = req.body;
      await recordFailedAttempt(db, context, error);
    }
    next(error);
  };
}
