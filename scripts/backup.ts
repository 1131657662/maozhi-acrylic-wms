import { mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { developmentConfig } from '../apps/api/src/db/config.ts';
import { openDatabase } from '../apps/api/src/db/mysql.ts';
import { mysqlDump } from '../apps/api/src/features/maintenance/dump.ts';
import { randomUUID } from 'node:crypto';
import path from 'node:path';
import { localMaintenanceOptions } from '../apps/api/src/features/maintenance/options.ts';
import { MaintenanceService } from '../apps/api/src/features/maintenance/service.ts';

const config = developmentConfig();
const db = openDatabase(config);
const local = fileURLToPath(new URL('../.local/', import.meta.url));
try {
  const identity = await db.get("SELECT value FROM app_meta WHERE meta_key='identity'");
  if (identity?.value !== 'maozhi-local-mysql8-v1') throw new Error('数据库身份不匹配');
  const migration = await db.get("SELECT state FROM schema_migrations WHERE id='027_restore_baselines'");
  if (migration?.state === 'applied') await registeredBackup();
  else await legacyBackup();
} finally {
  await db.close();
}

async function registeredBackup(): Promise<void> {
  const accounts = await db.all('SELECT username FROM owner LIMIT 2');
  if (accounts.length !== 1) throw new Error('无法唯一确定备份操作账户');
  const options = localMaintenanceOptions(config);
  options.directory = fileURLToPath(
    new URL(`../apps/api/.local/backups/maintenance/${config.database}/`, import.meta.url),
  );
  const service = new MaintenanceService(db, options);
  const { jobId } = await service.create(
    { username: String(accounts[0]!.username), channel: 'web', traceId: randomUUID() },
    randomUUID(),
  );
  await service.settled();
  const job = await db.get('SELECT status,error FROM maintenance_jobs WHERE id=?', [jobId]);
  if (job?.status !== 'succeeded') throw new Error(String(job?.error));
  console.log(`含核验基线的备份已建立: ${path.join(options.directory, `${jobId}.sql`)}`);
}
async function legacyBackup(): Promise<void> {
  mkdirSync(`${local}/backups`, { recursive: true });
  const target = `${local}/backups/maozhi-${Date.now()}.sql`;
  await mysqlDump(config, target);
  console.log(`升级前原始备份已建立（无核验基线）: ${target}`);
}
