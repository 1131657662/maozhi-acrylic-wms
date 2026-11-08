import { readFileSync, writeFileSync } from 'node:fs';
import { adminDatabase, adminConfig, quoteDatabase } from './mysql/local-config.ts';
import { openDatabase } from '../apps/api/src/db/mysql.ts';
import { migrateUp } from '../apps/api/src/db/migrate.ts';
import { identity, seedFromSamples } from '../apps/api/src/db/seed.ts';

const database = 'maozhi_dev_sample';
const admin = await adminDatabase();
await admin.run(`CREATE DATABASE IF NOT EXISTS ${quoteDatabase(database)} CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_bin`);
await admin.run(`GRANT SELECT,INSERT,UPDATE,DELETE,CREATE,ALTER,DROP,INDEX,REFERENCES,CREATE VIEW,SHOW VIEW,TRIGGER ON ${quoteDatabase(database)}.* TO 'wms_dev'@'127.0.0.1'`);
await admin.close();

const db = openDatabase({ ...adminConfig(), database });
try {
  await migrateUp(db);
  const meta = await db.get("SELECT value FROM app_meta WHERE meta_key='identity'");
  if (!meta) await seedFromSamples(db, readPassword());
  else if (meta.value !== identity) throw new Error('样本开发库身份不匹配');
} finally {
  await db.close();
}

const devPath = new URL('../.local/mysql/dev.json', import.meta.url);
const devConfig = JSON.parse(readFileSync(devPath, 'utf8')) as Record<string, unknown>;
writeFileSync(devPath, `${JSON.stringify({ ...devConfig, database }, null, 2)}\n`, { mode: 0o600 });
console.log(`真实样本开发库已就绪: 127.0.0.1:3307/${database}`);

function readPassword(): string {
  const path = new URL('../.local/demo-access.txt', import.meta.url);
  const match = readFileSync(path, 'utf8').match(/密码: (.+)/);
  if (!match) throw new Error('缺少本地登录密码文件');
  return match[1]!;
}
