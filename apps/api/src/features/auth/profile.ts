import { profileSchema, accountSessionsSchema, type Profile, type AccountSession } from '@wms/contracts';
import type { Database } from '../../db/mysql.ts';
import { isoDate } from '../../db/dates.ts';
import { hash } from '../../shared/hash.ts';
import { unauthorized } from './session.ts';

export async function readProfile(db: Database, token: string): Promise<Profile> {
  const row = await db.get(
    `SELECT o.username,o.display_name,o.password_changed_at,s.channel,s.expires_at,s.created_at
    FROM sessions s INNER JOIN owner o ON o.username=s.username AND o.auth_epoch=s.epoch
    WHERE s.token_hash=? AND s.expires_at>?`,
    [hash(token), Date.now()],
  );
  if (!row) throw unauthorized();
  const previous = await db.get(
    `SELECT MAX(created_at) AS logged_at FROM operation_log
    WHERE actor=? AND action='auth.login' AND created_at<?`,
    [String(row.username), String(row.created_at)],
  );
  return profileSchema.parse({
    username: row.username,
    displayName: row.display_name,
    channel: row.channel,
    lastLoginAt: previous?.logged_at == null ? null : isoDate(previous.logged_at),
    expiresAt: new Date(Number(row.expires_at)).toISOString(),
    passwordChangedAt: row.password_changed_at == null ? null : isoDate(row.password_changed_at),
  });
}
export async function listSessions(db: Database, token: string): Promise<AccountSession[]> {
  const profile = await readProfile(db, token);
  const rows = await db.all(
    `SELECT s.id,s.channel,s.created_at,s.expires_at,(s.token_hash=?) AS is_current
    FROM sessions s INNER JOIN owner o ON o.username=s.username AND o.auth_epoch=s.epoch
    WHERE s.username=? AND s.expires_at>? ORDER BY s.created_at DESC,s.id DESC`,
    [hash(token), profile.username, Date.now()],
  );
  return accountSessionsSchema.parse(
    rows.map((row) => ({
      id: row.id,
      channel: row.channel,
      createdAt: isoDate(row.created_at),
      expiresAt: new Date(Number(row.expires_at)).toISOString(),
      isCurrent: Number(row.is_current) === 1,
    })),
  );
}
