import { readFileSync } from 'node:fs';
import { z } from 'zod';
import { openDatabase, type DatabaseConfig } from '../../apps/api/src/db/mysql.ts';

const schema = z.object({ host: z.literal('127.0.0.1'), port: z.literal(3307),
  user: z.literal('root'), password: z.string().min(16) });
export function adminConfig(): DatabaseConfig {
  return schema.parse(JSON.parse(readFileSync(new URL('../../.local/mysql/admin.json', import.meta.url), 'utf8')));
}
export async function adminDatabase() {
  const db = openDatabase(adminConfig());
  const server = await db.get('SELECT VERSION() AS version,@@datadir AS directory');
  if (!String(server?.version).startsWith('8.')) { await db.close(); throw new Error('必须使用 MySQL 8'); }
  const expected = new URL('../../.local/mysql/data/', import.meta.url).pathname.replace(/^\//,'').toLowerCase();
  if (String(server?.directory).replaceAll('\\','/').toLowerCase() !== expected) {
    await db.close(); throw new Error('实例目录不匹配，禁止连接已有服务');
  }
  return db;
}
export function quoteDatabase(name: string): string {
  if (!/^maozhi_(dev|test_[a-f0-9]+|restore_[a-f0-9]+)$/.test(name)) throw new Error('数据库名不在开发白名单');
  return `\`${name}\``;
}
