import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { randomBytes } from 'node:crypto';
import { openDatabase } from '../../apps/api/src/db/mysql.ts';
import { adminConfig } from './local-config.ts';

const root = new URL('../../.local/mysql/', import.meta.url);
export async function bootstrapMysql(): Promise<void> {
  if (existsSync(new URL('admin.json', root))) return;
  const marker = JSON.parse(readFileSync(new URL('instance.json', root), 'utf8').replace(/^\uFEFF/, ''));
  if (marker.identity !== 'maozhi-isolated-mysql8') throw new Error('缺少独立实例标记');
  const config = { host: '127.0.0.1', port: 3307, user: 'root', password: randomBytes(32).toString('hex') };
  const db = openDatabase({ ...config, password: '' });
  try {
    const server = await db.get('SELECT VERSION() AS version,@@datadir AS directory');
    const expected = fileURLToPath(new URL('data/', root)).replaceAll('\\', '/').toLowerCase();
    if (!String(server?.version).startsWith('8.') || String(server?.directory).replaceAll('\\','/').toLowerCase() !== expected)
      throw new Error('拒绝初始化未知实例');
    writeFileSync(new URL('admin.json', root), JSON.stringify(config), { flag: 'wx', mode: 0o600 });
    await db.run("ALTER USER 'root'@'localhost' IDENTIFIED BY ?", [config.password]);
  } finally { await db.close(); }
}
export async function createDevelopmentUser(): Promise<void> {
  const path = new URL('dev.json', root);
  if (existsSync(path)) return;
  const config = { host: '127.0.0.1', port: 3307, user: 'wms_dev',
    password: randomBytes(32).toString('hex'), database: 'maozhi_dev' };
  const db = openDatabase(adminConfig());
  try {
    await db.run("CREATE DATABASE IF NOT EXISTS maozhi_dev CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_bin");
    await db.run("CREATE USER 'wms_dev'@'127.0.0.1' IDENTIFIED BY ?", [config.password]);
    await db.run("GRANT SELECT,INSERT,UPDATE,DELETE,CREATE,ALTER,DROP,INDEX,REFERENCES,CREATE VIEW,SHOW VIEW,TRIGGER ON maozhi_dev.* TO 'wms_dev'@'127.0.0.1'");
    writeFileSync(path, JSON.stringify(config), { flag: 'wx', mode: 0o600 });
  } finally { await db.close(); }
}
