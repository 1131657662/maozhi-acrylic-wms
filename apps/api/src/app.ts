import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import type { Database } from './db/mysql.ts';
import { authRouter } from './features/auth/router.ts';
import { businessRouter } from './routes.ts';
import { trace, errors, ok } from './middleware/http.ts';
import { AppError } from './shared/errors.ts';

export const localOrigins = [
  'http://localhost:5173',
  'http://127.0.0.1:5173',
  'http://localhost:4173',
  'http://127.0.0.1:4173',
  'http://localhost:4310',
  'http://127.0.0.1:4310',
  'http://localhost:4311',
  'http://127.0.0.1:4311',
];

export function createApp(db: Database, origins: string[] = localOrigins): express.Express {
  const app = express();
  app.disable('x-powered-by');
  app.use(
    trace,
    helmet(),
    cors({ origin: origins, credentials: true }),
    express.json({ limit: '10kb' }),
    cookieParser(),
  );
  app.use((req, _res, next) => {
    if (req.get('origin') && !origins.includes(req.get('origin')!))
      throw new AppError('ORIGIN_NOT_ALLOWED', '请求来源不允许', 403);
    next();
  });
  app.get('/api/v1/health', (_req, res) => ok(res, { status: 'ok', mode: 'local-development', database: 'mysql8' }));
  app.use('/api/v1/auth', authRouter(db));
  app.use('/api/v1', businessRouter(db, origins));
  app.use(() => {
    throw new AppError('NOT_FOUND', '接口不存在', 404);
  });
  app.use(errors);
  return app;
}
