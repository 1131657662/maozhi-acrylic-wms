import { randomBytes, randomUUID } from 'node:crypto';
import bcrypt from 'bcryptjs';
import { AUTH_POLICY as policy, AUTH_TEXT as text, type Session } from '@wms/contracts';
import type { Database, Row } from '../../db/mysql.ts';
import { isoDate, sqlDate } from '../../db/dates.ts';
import { TransactionOutcomeUnknown } from '../../db/transaction-outcome.ts';
import { AppError } from '../../shared/errors.ts';
import { hash } from '../../shared/hash.ts';
import { audit, type Actor } from '../../shared/audit.ts';
import { auditContext, identifyAuditActor, observeAuditTransaction } from '../audit/context.ts';

interface LoginInput extends Session {
  password: string;
}
interface LoginResult extends Session {
  token: string;
  passwordChangeRecommended: boolean;
}
interface CheckedLogin {
  input: LoginInput;
  snapshot: Row;
  valid: boolean;
  actor: Actor;
}
const dummyHash = bcrypt.hashSync(randomBytes(policy.tokenBytes).toString('hex'), policy.bcryptRounds);
const invalid = () => new AppError('INVALID_CREDENTIALS', text.invalidCredentials, 401);

function locked(row: Row): AppError | null {
  const remaining = row.locked_until == null ? 0 : Date.parse(isoDate(row.locked_until)) - Date.now();
  return remaining > 0
    ? new AppError('ACCOUNT_LOCKED', text.locked, 429, { retryAfterSeconds: Math.ceil(remaining / 1000) })
    : null;
}
async function failed(db: Database, row: Row): Promise<AppError> {
  const count = (row.locked_until == null ? Number(row.failed_attempts) : 0) + 1;
  const until = count >= policy.failureLimit ? sqlDate(new Date(Date.now() + policy.lockMs).toISOString()) : null;
  await db.run('UPDATE owner SET failed_attempts=?,locked_until=? WHERE username=?', [
    count,
    until,
    String(row.username),
  ]);
  return until
    ? new AppError('ACCOUNT_LOCKED', text.locked, 429, { retryAfterSeconds: policy.lockMs / 1000 })
    : invalid();
}
async function issue(db: Database, checked: CheckedLogin, owner: Row): Promise<LoginResult> {
  const { input, actor } = checked;
  const token = randomBytes(policy.tokenBytes).toString('base64url');
  const now = Date.now();
  identifyAuditActor({ ...actor, username: input.username, channel: input.channel });
  await db.run('UPDATE owner SET failed_attempts=0,locked_until=NULL WHERE username=?', [input.username]);
  await db.run('DELETE FROM sessions WHERE username=? AND expires_at<=?', [input.username, now]);
  await db.run(
    `INSERT INTO sessions(token_hash,username,channel,expires_at,id,created_at,epoch)
    VALUES(?,?,?,?,?,?,?)`,
    [
      hash(token),
      input.username,
      input.channel,
      now + policy.sessionMs,
      randomUUID(),
      sqlDate(new Date(now).toISOString()),
      Number(owner.auth_epoch),
    ],
  );
  await audit(
    db,
    { ...actor, username: input.username, channel: input.channel },
    { action: 'auth.login', targetId: input.username, before: null, after: { channel: input.channel } },
  );
  return {
    username: input.username,
    channel: input.channel,
    token,
    passwordChangeRecommended: bcrypt.truncates(input.password),
  };
}
async function complete(db: Database, checked: CheckedLogin): Promise<LoginResult | AppError> {
  const owner = await db.get('SELECT * FROM owner WHERE username=? FOR UPDATE', [checked.input.username]);
  if (!owner) return invalid();
  const lock = locked(owner);
  if (lock) return lock;
  if (owner.auth_epoch !== checked.snapshot.auth_epoch || owner.password_hash !== checked.snapshot.password_hash)
    return invalid();
  return checked.valid ? issue(db, checked, owner) : failed(db, owner);
}
export async function login(db: Database, input: LoginInput, actor: Actor): Promise<LoginResult> {
  const snapshot = await db.get('SELECT * FROM owner WHERE username=?', [input.username]);
  const lock = snapshot && locked(snapshot);
  if (lock) throw lock;
  const valid = await bcrypt.compare(input.password, snapshot ? String(snapshot.password_hash) : dummyHash);
  if (!snapshot) throw invalid();
  // Counter commits are not successful login events. Failure evidence stays in its own transaction.
  const parent = auditContext.getStore();
  const result = await auditContext
    .run(parent ? { ...parent } : undefined, () =>
      db.transaction((tx) => complete(tx, { input, snapshot, valid, actor })),
    )
    .catch((error: unknown) => {
      if (error instanceof TransactionOutcomeUnknown) observeAuditTransaction('unknown');
      throw error;
    });
  if (result instanceof AppError) throw result;
  identifyAuditActor({ ...result, traceId: actor.traceId });
  observeAuditTransaction('committed');
  return result;
}
