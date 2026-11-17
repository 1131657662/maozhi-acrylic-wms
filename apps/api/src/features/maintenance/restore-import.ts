import { spawn } from 'node:child_process';
import { pipeline } from 'node:stream/promises';
import type { Readable } from 'node:stream';
import { RESTORE } from '@wms/contracts';
import type { DatabaseConfig } from '../../db/mysql.ts';
import { AppError } from '../../shared/errors.ts';
import { guardedRestoreSql } from './restore-sql.ts';
import { restoreText as t } from './restore-copy.ts';

export async function importRestore(source: Readable, config: DatabaseConfig): Promise<void> {
  if (!/^mr_[a-f0-9]{24}$/.test(config.user) || !/^maozhi_restore_[a-f0-9]{24}$/.test(config.database ?? ''))
    throw new AppError('RESTORE_OWNERSHIP', t.ownership, 409);
  const child = spawn(
    'mysql',
    [
      '--no-defaults',
      '--host',
      config.host,
      '--port',
      String(config.port),
      '--user',
      config.user,
      '--one-database',
      '--binary-mode',
      '--local-infile=0',
      config.database!,
    ],
    {
      env: { ...process.env, MYSQL_PWD: config.password },
      stdio: ['pipe', 'ignore', 'pipe'],
      windowsHide: true,
      timeout: RESTORE.importTimeoutMs,
      killSignal: 'SIGKILL',
    },
  );
  let diagnostic = '';
  child.stderr.setEncoding('utf8');
  child.stderr.on('data', (chunk: string) => {
    diagnostic = (diagnostic + chunk).slice(0, RESTORE.diagnosticBytes);
  });
  const closed = new Promise<void>((resolve, reject) => {
    child.once('error', reject);
    child.once('close', (code) => {
      const number = /ERROR (\d+)/.exec(diagnostic)?.[1],
        line = /at line (\d+)/.exec(diagnostic)?.[1];
      const reason = `${t.importFailed}${number ? `；数据库错误编号 ${number}` : ''}${line ? `；备份行号 ${line}` : ''}`;
      code === 0 ? resolve() : reject(new AppError('RESTORE_IMPORT_FAILED', reason, 409));
    });
  });
  try {
    await Promise.all([closed, pipeline(guardedRestoreSql(source), child.stdin)]);
  } catch (error) {
    source.destroy();
    child.kill('SIGKILL');
    await closed.catch(() => undefined);
    throw error instanceof AppError ? error : new AppError('RESTORE_IMPORT_FAILED', t.importFailed, 409);
  }
}
