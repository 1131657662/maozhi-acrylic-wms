import { createWriteStream } from 'node:fs';
import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process';
import { pipeline } from 'node:stream/promises';
import { MAINTENANCE } from '@wms/contracts';
import type { DatabaseConfig } from '../../db/mysql.ts';
import { AppError } from '../../shared/errors.ts';
import { maintenanceErrors as copy } from './copy.ts';

async function writeDump(child: ChildProcessWithoutNullStreams, filename: string): Promise<void> {
  child.stdin.end();
  child.stderr.resume();
  const closed = new Promise<void>((resolve, reject) => {
    child.once('error', reject);
    child.once('close', (code) => (code === 0 ? resolve() : reject(new Error('dump failed'))));
  });
  try {
    await Promise.all([closed, pipeline(child.stdout, createWriteStream(filename, { flags: 'wx', mode: 0o600 }))]);
  } catch {
    child.kill('SIGKILL');
    throw new AppError('BACKUP_DUMP_FAILED', copy.dump, 503);
  }
}
export async function mysqlDump(config: DatabaseConfig, filename: string): Promise<void> {
  if (!config.database) throw new AppError('BACKUP_IDENTITY', copy.identity, 409);
  const child = spawn(
    'mysqldump',
    [
      '--host',
      config.host,
      '--port',
      String(config.port),
      '--user',
      config.user,
      '--single-transaction',
      '--skip-lock-tables',
      '--hex-blob',
      '--skip-routines',
      config.database,
    ],
    {
      env: { ...process.env, MYSQL_PWD: config.password },
      stdio: 'pipe',
      windowsHide: true,
      timeout: MAINTENANCE.dumpTimeoutMs,
      killSignal: 'SIGKILL',
    },
  );
  await writeDump(child, filename);
}
