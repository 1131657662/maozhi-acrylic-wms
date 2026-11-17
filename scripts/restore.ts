import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { realpath } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { developmentConfig } from '../apps/api/src/db/config.ts';
import { openDatabase } from '../apps/api/src/db/mysql.ts';
import { localMaintenanceOptions } from '../apps/api/src/features/maintenance/options.ts';
import { MaintenanceService } from '../apps/api/src/features/maintenance/service.ts';
import { restoreDetail } from '../apps/api/src/features/maintenance/restore-records.ts';
import { registerLegacyRestore } from './mysql/restore-artifact.ts';
import { restorePreflight } from '../apps/api/src/features/maintenance/restore-preflight.ts';

const input = process.argv[2];
if (!input || !path.isAbsolute(input) || !input.toLowerCase().endsWith('.sql') || process.argv[3] !== 'RECOVER')
  throw new Error('用法：npm run restore -- <本项目备份的绝对SQL路径> RECOVER。仅隔离恢复，不覆盖当前库。');
const config = developmentConfig(),
  db = openDatabase(config);
const options = localMaintenanceOptions(config);
const repository = fileURLToPath(new URL('../', import.meta.url));
const allowedDirectories = [repository, path.join(repository, 'apps/api')].map((root) =>
  path.join(root, '.local/backups/maintenance', config.database),
);
const legacyRoot = path.join(repository, '.local/backups');
const legacy = path.dirname(path.resolve(input)) === legacyRoot;
if (!legacy && !allowedDirectories.includes(path.dirname(path.resolve(input))))
  throw new Error('备份路径不属于本项目维护产物目录');
options.directory = legacy ? allowedDirectories[1]! : path.dirname(path.resolve(input));
const service = new MaintenanceService(db, options);
try {
  if ((await db.get("SELECT state FROM schema_migrations WHERE id='027_restore_baselines'"))?.state !== 'applied')
    throw new Error('须先按迁移流程应用027；恢复命令不自动迁移。');
  await restorePreflight(db);
  const accounts = await db.all('SELECT username FROM owner LIMIT 2');
  if (accounts.length !== 1) throw new Error('无法唯一确定恢复操作账户');
  const actor = { username: String(accounts[0]!.username), channel: 'web' as const, traceId: randomUUID() };
  const artifact = legacy
    ? { id: await registerLegacyRestore(db, actor, { filename: input, root: legacyRoot, options }) }
    : await db.get('SELECT id,path FROM backup_artifacts WHERE path=?', [path.basename(input)]);
  if (
    !artifact ||
    (!legacy && (await realpath(input)) !== (await realpath(path.join(options.directory, String(artifact.path)))))
  )
    throw new Error('备份文件未登记或路径不符');
  const { jobId } = await service.restores.create(actor, randomUUID(), {
    artifactId: String(artifact.id),
    confirmation: 'RECOVER',
  });
  await service.settled();
  console.log(JSON.stringify(await restoreDetail(db, jobId), null, 2));
  if ((await db.get('SELECT status FROM maintenance_jobs WHERE id=?', [jobId]))?.status !== 'succeeded')
    process.exitCode = 1;
} finally {
  await service.settled();
  await db.close();
}
