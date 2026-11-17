import bcrypt from 'bcryptjs';
import { AUTH_POLICY, AUTH_TEXT, passwordRuleError, type PasswordInput } from '@wms/contracts';
import type { Database } from '../../db/mysql.ts';
import { audit, type Actor } from '../../shared/audit.ts';
import { AppError } from '../../shared/errors.ts';
import { lockAuthenticated } from './session.ts';

interface AccountCommand {
  token: string;
  actor: Actor;
}
export async function updateProfile(db: Database, command: AccountCommand & { displayName: string }): Promise<void> {
  await db.transaction(async (tx) => {
    const { owner } = await lockAuthenticated(tx, command.token);
    const name = command.displayName || null;
    await tx.run('UPDATE owner SET display_name=? WHERE username=?', [name, String(owner.username)]);
    await audit(tx, command.actor, {
      action: 'auth.profile',
      targetId: String(owner.username),
      before: { displayName: owner.display_name },
      after: { displayName: name },
    });
  });
}
export async function changePassword(db: Database, command: AccountCommand & PasswordInput): Promise<void> {
  const rule = passwordRuleError(command.newPassword);
  if (rule) throw new AppError('PASSWORD_RULE', rule, 422);
  const nextHash = await bcrypt.hash(command.newPassword, AUTH_POLICY.bcryptRounds);
  await db.transaction(async (tx) => {
    const { owner } = await lockAuthenticated(tx, command.token);
    if (!(await bcrypt.compare(command.oldPassword, String(owner.password_hash))))
      throw new AppError('OLD_PASSWORD_INVALID', AUTH_TEXT.oldPassword, 422);
    await tx.run(
      `UPDATE owner SET password_hash=?,password_changed_at=UTC_TIMESTAMP(3),auth_epoch=auth_epoch+1
      WHERE username=?`,
      [nextHash, String(owner.username)],
    );
    await tx.run('DELETE FROM sessions WHERE username=?', [String(owner.username)]);
    await audit(tx, command.actor, {
      action: 'auth.password',
      targetId: String(owner.username),
      before: null,
      after: { allSessionsRevoked: true },
    });
  });
}
export async function revokeSession(
  db: Database,
  command: AccountCommand & { id: string },
): Promise<{ current: boolean }> {
  return db.transaction(async (tx) => {
    const { owner, session } = await lockAuthenticated(tx, command.token);
    const target = await tx.get('SELECT id,channel FROM sessions WHERE id=? AND username=? FOR UPDATE', [
      command.id,
      String(owner.username),
    ]);
    if (!target) throw new AppError('SESSION_NOT_FOUND', AUTH_TEXT.missingSession, 404);
    const current = target.id === session.id;
    await tx.run('DELETE FROM sessions WHERE id=? AND username=?', [command.id, String(owner.username)]);
    await audit(tx, command.actor, {
      action: 'auth.session.revoke',
      targetId: String(owner.username),
      before: null,
      after: { channel: target.channel, current },
    });
    return { current };
  });
}
