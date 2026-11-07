import { Router } from 'express';
import { rateLimit } from 'express-rate-limit';
import type { Database } from '../../db/mysql.ts';
import { loginSchema } from '@wms/contracts';
import { login, logout } from './service.ts';
import { actorFrom, ok, requireAuth, tokenFrom } from '../../middleware/http.ts';

export function authRouter(db: Database): Router {
  const router = Router();
  router.post(
    '/login',
    rateLimit({
      windowMs: 15 * 60000,
      limit: 20,
      standardHeaders: 'draft-8',
      legacyHeaders: false,
      handler: (_req, res) =>
        res
          .status(429)
          .json({ code: 'RATE_LIMITED', message: '登录尝试过多，请稍后重试', data: null, traceId: res.locals.traceId }),
    }),
    async (req, res) => {
      const input = loginSchema.parse(req.body);
      const result = await login(db, input, { username: input.username, traceId: String(res.locals.traceId) });
      if (result.channel === 'web') {
        res.cookie('wms_session', result.token, {
          httpOnly: true,
          sameSite: 'strict',
          secure: req.secure,
          maxAge: 8 * 3600000,
          path: '/api',
        });
        ok(res, { username: result.username, channel: result.channel });
      } else ok(res, result);
    },
  );
  router.get('/me', requireAuth(db), (_req, res) => ok(res, res.locals.session));
  router.post('/logout', requireAuth(db), async (req, res) => {
    await logout(db, tokenFrom(req), actorFrom(res));
    res.clearCookie('wms_session', { path: '/api' });
    ok(res, null);
  });
  return router;
}
