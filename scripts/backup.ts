import { createWriteStream, mkdirSync } from 'node:fs';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { developmentConfig } from '../apps/api/src/db/config.ts';
import { openDatabase } from '../apps/api/src/db/mysql.ts';

const config = developmentConfig();
const db = openDatabase(config);
const identity = await db.get("SELECT value FROM app_meta WHERE meta_key='identity'");
if (identity?.value !== 'maozhi-local-mysql8-v1') throw new Error('数据库身份不匹配');
await db.close();

const local = fileURLToPath(new URL('../.local/', import.meta.url));
mkdirSync(`${local}/backups`, { recursive: true });
const target = `${local}/backups/maozhi-${Date.now()}.sql`;
const output = createWriteStream(target, { flags: 'wx', mode: 0o600 });
const child = spawn('mysqldump', [
  '--host', config.host, '--port', String(config.port), '--user', config.user,
  '--single-transaction', '--skip-lock-tables', '--hex-blob', '--skip-routines', config.database!,
], { env: { ...process.env, MYSQL_PWD: config.password }, stdio: ['ignore', 'pipe', 'pipe'] });
child.stdout.pipe(output);
let stderr = '';
child.stderr.setEncoding('utf8');
child.stderr.on('data', (chunk: string) => { stderr += chunk; });
await new Promise<void>((resolve, reject) => {
  child.once('error', reject);
  child.once('close', (code) => code === 0 ? resolve() : reject(new Error(stderr || `mysqldump 退出码 ${code}`)));
});
console.log(`MySQL 备份已建立: ${target}`);
