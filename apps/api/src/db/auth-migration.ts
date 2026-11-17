import type { Database } from './mysql.ts';

export async function guardAuthDown(db: Database): Promise<void> {
  const owner = await db.get(`SELECT username FROM owner WHERE display_name IS NOT NULL
    OR password_changed_at IS NOT NULL OR auth_epoch<>0 OR failed_attempts<>0 OR locked_until IS NOT NULL LIMIT 1`);
  const session = await db.get('SELECT id FROM sessions LIMIT 1');
  if (owner || session) throw new Error('拒绝回退：身份扩展或会话含有数据，禁止删除安全记录');
}
