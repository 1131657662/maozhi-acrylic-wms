import { mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { developmentConfig } from '../apps/api/src/db/config.ts';
import { openDatabase } from '../apps/api/src/db/mysql.ts';
import { mysqlDump } from '../apps/api/src/features/maintenance/dump.ts';

const config = developmentConfig();
const db = openDatabase(config);
const identity = await db.get("SELECT value FROM app_meta WHERE meta_key='identity'");
if (identity?.value !== 'maozhi-local-mysql8-v1') throw new Error('数据库身份不匹配');
await db.close();

const local = fileURLToPath(new URL('../.local/', import.meta.url));
mkdirSync(`${local}/backups`, { recursive: true });
const target = `${local}/backups/maozhi-${Date.now()}.sql`;
await mysqlDump(config, target);
console.log(`MySQL 备份已建立: ${target}`);
