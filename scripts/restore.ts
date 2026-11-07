import { createReadStream } from 'node:fs';
import { randomBytes } from 'node:crypto';
import { spawn } from 'node:child_process';
import { adminDatabase, adminConfig, quoteDatabase } from './mysql/local-config.ts';
import { openDatabase } from '../apps/api/src/db/mysql.ts';

const input = process.argv[2];
if (!input || !input.toLowerCase().endsWith('.sql'))
  throw new Error('用法: npm run restore -- <MySQL .sql 备份文件绝对路径>。恢复到新库，不覆盖现有库。');
const name = `maozhi_restore_${randomBytes(8).toString('hex')}`;
const admin = await adminDatabase();
await admin.run(`CREATE DATABASE ${quoteDatabase(name)} CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_bin`);
await admin.close();

const config = { ...adminConfig(), database: name };
try {
  await runMysqlImport(input, config);
  const restored = openDatabase(config);
  try {
    const identity = await restored.get("SELECT value FROM app_meta WHERE meta_key='identity'");
    if (identity?.value !== 'maozhi-local-mysql8-v1') throw new Error('拒绝恢复非本项目 MySQL 合成库');
    await restored.run('DELETE FROM sessions');
  } finally { await restored.close(); }
  console.log(`MySQL 备份已恢复到新库: ${name}\n没有覆盖当前开发库；切换前请停止服务并保留原库。`);
} catch (error) {
  const cleanup = await adminDatabase();
  try { await cleanup.run(`DROP DATABASE ${quoteDatabase(name)}`); } finally { await cleanup.close(); }
  throw error;
}

async function runMysqlImport(inputPath: string, config: { host: string; port: number; user: string; password: string; database: string }): Promise<void> {
  const child = spawn('mysql', [
    '--host', config.host, '--port', String(config.port), '--user', config.user, config.database,
  ], { env: { ...process.env, MYSQL_PWD: config.password }, stdio: ['pipe', 'ignore', 'pipe'] });
  createReadStream(inputPath).pipe(child.stdin);
  let stderr = '';
  child.stderr.setEncoding('utf8');
  child.stderr.on('data', (chunk: string) => { stderr += chunk; });
  await new Promise<void>((resolve, reject) => {
    child.once('error', reject);
    child.once('close', (code) => code === 0 ? resolve() : reject(new Error(stderr || `mysql 退出码 ${code}`)));
  });
}
