import type { Request, Response } from 'express';
import { z } from 'zod';
import { profileInputSchema, passwordInputSchema } from '@wms/contracts';
import type { Database } from '../../db/mysql.ts';
import { actorFrom, tokenFrom, ok } from '../../middleware/http.ts';
import { readProfile, listSessions } from './profile.ts';
import { updateProfile, changePassword, revokeSession } from './account-commands.ts';
import { logout } from './service.ts';

export function accountController(db: Database) {
  const read = async (req: Request, res: Response) => ok(res, await readProfile(db, tokenFrom(req)));
  const sessions = async (req: Request, res: Response) => ok(res, await listSessions(db, tokenFrom(req)));
  const profile = async (req: Request, res: Response) => {
    await updateProfile(db, { ...profileInputSchema.parse(req.body), token: tokenFrom(req), actor: actorFrom(res) });
    ok(res, null);
  };
  const password = async (req: Request, res: Response) => {
    await changePassword(db, { ...passwordInputSchema.parse(req.body), token: tokenFrom(req), actor: actorFrom(res) });
    res.clearCookie('wms_session', { path: '/api' });
    ok(res, null);
  };
  const revoke = async (req: Request, res: Response) => {
    const result = await revokeSession(db, {
      id: z.uuid().parse(req.params.id),
      token: tokenFrom(req),
      actor: actorFrom(res),
    });
    if (result.current) res.clearCookie('wms_session', { path: '/api' });
    ok(res, result);
  };
  const exit = async (req: Request, res: Response) => {
    await logout(db, tokenFrom(req), actorFrom(res));
    res.clearCookie('wms_session', { path: '/api' });
    ok(res, null);
  };
  return { read, profile, password, sessions, revoke, exit };
}
