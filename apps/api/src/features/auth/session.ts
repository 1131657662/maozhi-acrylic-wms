import { AUTH_TEXT, sessionSchema, type Session } from '@wms/contracts';
import type { Database, Row } from '../../db/mysql.ts';
import { hash } from '../../shared/hash.ts';
import { AppError } from '../../shared/errors.ts';

export function unauthorized(): AppError {
  return new AppError('UNAUTHORIZED', AUTH_TEXT.unauthorized, 401);
}
export async function authenticate(db: Database, token: string): Promise<Session> {
  const row = await db.get(
    `SELECT s.username,s.channel FROM sessions s
    INNER JOIN owner o ON o.username=s.username AND o.auth_epoch=s.epoch
    WHERE s.token_hash=? AND s.expires_at>?`,
    [hash(token), Date.now()],
  );
  if (!row) throw unauthorized();
  return sessionSchema.parse(row);
}
// Account writes lock owner before rechecking the session, consistently with login.
export async function lockAuthenticated(db: Database, token: string): Promise<{ owner: Row; session: Row }> {
  const tokenHash = hash(token);
  const hint = await db.get('SELECT username FROM sessions WHERE token_hash=?', [tokenHash]);
  if (!hint) throw unauthorized();
  const owner = await db.get('SELECT * FROM owner WHERE username=? FOR UPDATE', [String(hint.username)]);
  const session = await db.get('SELECT * FROM sessions WHERE token_hash=? AND expires_at>? FOR UPDATE', [
    tokenHash,
    Date.now(),
  ]);
  if (!owner || !session || session.username !== owner.username || session.epoch !== owner.auth_epoch)
    throw unauthorized();
  return { owner, session };
}
