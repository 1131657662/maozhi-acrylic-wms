import { readFile } from 'node:fs/promises';
import { z } from 'zod';
import { openDatabase, type Database } from '../../db/mysql.ts';

export async function maintenanceAdmin(): Promise<Database> {
  const config = z
    .object({
      host: z.literal('127.0.0.1'),
      port: z.literal(3307),
      user: z.literal('root'),
      password: z.string().min(16),
    })
    .parse(JSON.parse(await readFile(new URL('../../../../../.local/mysql/admin.json', import.meta.url), 'utf8')));
  const db = openDatabase(config);
  try {
    const server = await db.get('SELECT VERSION() AS version,@@datadir AS directory');
    const expected = new URL('../../../../../.local/mysql/data/', import.meta.url).pathname
      .replace(/^\//, '')
      .toLowerCase();
    if (
      !String(server?.version).startsWith('8.') ||
      String(server?.directory).replaceAll('\\', '/').toLowerCase() !== expected
    )
      throw new Error('维护实例身份不匹配');
    return db;
  } catch (error) {
    await db.close();
    throw error;
  }
}
