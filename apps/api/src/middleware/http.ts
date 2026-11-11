import type { ErrorRequestHandler, Request, RequestHandler, Response } from 'express';
import type { Database } from '../db/mysql.ts';
import { randomUUID } from 'node:crypto';
import { ZodError } from 'zod';
import { sessionSchema } from '@wms/contracts';
import { AppError } from '../shared/errors.ts';
import { authenticate } from '../features/auth/service.ts';
import type { Actor } from '../shared/audit.ts';
import { logger } from '../shared/logger.ts';
import { validationMessage } from './validation-message.ts';
import { identifyAuditActor } from '../features/audit/context.ts';
import { TransactionOutcomeUnknown } from '../db/transaction-outcome.ts';

export const trace: RequestHandler = (req, res, next) => {
  res.locals.traceId = randomUUID();
  res.set('X-Request-Id', String(res.locals.traceId));
  const start = Date.now();
  const path = req.path;
  res.on('finish', () =>
    logger.info(
      {
        traceId: res.locals.traceId,
        method: req.method,
        path,
        status: res.statusCode,
        ms: Date.now() - start,
      },
      'request',
    ),
  );
  next();
};

export function tokenFrom(req: Request): string {
  const cookie: unknown = req.cookies?.wms_session;
  return req.headers.authorization?.replace(/^Bearer /, '') ?? (typeof cookie === 'string' ? cookie : '');
}

export function requireAuth(db: Database): RequestHandler {
  return async (req, res, next) => {
    res.locals.session = await authenticate(db, tokenFrom(req));
    identifyAuditActor({ ...sessionSchema.parse(res.locals.session), traceId: String(res.locals.traceId) });
    next();
  };
}

export function requireChannel(channel: 'web' | 'pda', origins: string[]): RequestHandler {
  return (req, res, next) => {
    const session = sessionSchema.parse(res.locals.session);
    if (session.channel !== channel) throw new AppError('CLIENT_NOT_ALLOWED', '此客户端不允许执行该操作', 403);
    if (
      channel === 'web' &&
      ((!['GET', 'HEAD'].includes(req.method) && !origins.includes(req.get('origin') ?? '')) ||
        req.headers.authorization)
    )
      throw new AppError('ORIGIN_NOT_ALLOWED', 'Web 写操作需要同源会话', 403);
    next();
  };
}

export function actorFrom(res: Response): Actor {
  return { ...sessionSchema.parse(res.locals.session), traceId: String(res.locals.traceId) };
}

export function ok(res: Response, data: unknown, message = '成功'): void {
  res.json({ code: 'OK', message, data, traceId: res.locals.traceId });
}

export const errors: ErrorRequestHandler = (error: unknown, _req, res, _next) => {
  const known = error instanceof AppError;
  const invalid = error instanceof ZodError || (error instanceof SyntaxError && 'body' in error);
  const tooLarge = typeof error === 'object' && error !== null && 'type' in error && error.type === 'entity.too.large';
  const catalogUpload = _req.path.endsWith('/catalog/uploads');
  const status = known ? error.status : tooLarge ? 413 : invalid ? 422 : 500;
  if (status === 500) logger.error({ event: 'request_failed', traceId: res.locals.traceId,
    code: error instanceof TransactionOutcomeUnknown ? error.code : 'INTERNAL_ERROR' }, '请求未完成');
  res.status(status).json({
    code: error instanceof TransactionOutcomeUnknown ? error.code : known
      ? error.code
      : tooLarge
        ? catalogUpload
          ? 'CATALOG_FILE_TOO_LARGE'
          : 'PAYLOAD_TOO_LARGE'
        : invalid
          ? 'VALIDATION_ERROR'
          : 'INTERNAL_ERROR',
    message: error instanceof TransactionOutcomeUnknown ? error.message : known
      ? error.message
      : tooLarge
        ? catalogUpload
          ? '文件不能超过 5 MiB'
          : '请求正文超出允许大小'
        : invalid
          ? '请求字段或格式不正确'
          : '服务异常，请提供请求编号',
    data: known
      ? error.data
      : error instanceof ZodError
        ? {
          fields: error.issues.map((issue) => ({ path: issue.path, message: validationMessage(issue) })),
          }
        : null,
    traceId: res.locals.traceId,
  });
};
