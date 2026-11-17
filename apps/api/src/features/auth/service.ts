import type { Database } from '../../db/mysql.ts';
import { audit, type Actor } from '../../shared/audit.ts';
import { hash } from '../../shared/hash.ts';
import { lockAuthenticated } from './session.ts';
export { login } from './login.ts';
export { authenticate } from './session.ts';

export async function logout(db: Database, token: string, actor: Actor): Promise<void> {
  await db.transaction(async (tx) => {
    const { owner } = await lockAuthenticated(tx, token);
    await tx.run('DELETE FROM sessions WHERE token_hash=?', [hash(token)]);
    await audit(
      tx,
      { ...actor, username: String(owner.username) },
      { action: 'auth.logout', targetId: String(owner.username), before: null, after: null },
    );
  });
}
