import { spawn } from 'node:child_process';
import { mkdir, mkdtemp, writeFile, rm } from 'node:fs/promises';
import { randomBytes } from 'node:crypto';
import { createServer } from 'node:net';
import { setTimeout } from 'node:timers/promises';
import path from 'node:path';
import { openDatabase, type DatabaseConfig } from '../src/db/mysql.ts';
import { migrateUp } from '../src/db/migrate.ts';
import { seedDemo } from '../src/db/seed-test.ts';

const START_ATTEMPTS = 120,
  RETRY_MS = 250,
  PROCESS_TIMEOUT_MS = 120000;
async function unusedPort(): Promise<number> {
  const server = createServer();
  await new Promise<void>((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('缺少测试端口');
  await new Promise<void>((resolve) => server.close(() => resolve()));
  return address.port;
}
function mysqlProcess(args: string[]) {
  const child = spawn('mysqld', ['--no-defaults', ...(process.platform === 'win32' ? ['--no-monitor'] : []), ...args], {
    windowsHide: true,
    stdio: 'ignore',
    timeout: PROCESS_TIMEOUT_MS,
  });
  const closed = new Promise<void>((resolve, reject) => {
    child.once('error', reject);
    child.once('close', () => resolve());
  });
  return { child, closed };
}
async function awaitReady(config: DatabaseConfig): Promise<void> {
  for (let n = 0; n < START_ATTEMPTS; n++) {
    const db = openDatabase(config);
    try {
      await db.ping();
      return;
    } catch {
      await setTimeout(RETRY_MS);
    } finally {
      await db.close();
    }
  }
  throw new Error('独立故障验收数据库启动超时');
}
async function startServer(root: string, port: number) {
  const data = path.join(root, 'data'),
    password = randomBytes(24).toString('hex');
  const init = mysqlProcess([
    `--datadir=${data}`,
    `--log-error=${path.join(root, 'init.log')}`,
    '--initialize-insecure',
  ]);
  await init.closed;
  if (init.child.exitCode !== 0) throw new Error('独立故障验收数据库初始化失败');
  const sql = path.join(root, 'bootstrap.sql');
  await writeFile(sql, `ALTER USER 'root'@'localhost' IDENTIFIED BY '${password}';`, { mode: 0o600 });
  const process = mysqlProcess([
    `--datadir=${data}`,
    `--port=${port}`,
    '--bind-address=127.0.0.1',
    '--mysqlx=0',
    `--log-error=${path.join(root, 'server.log')}`,
    `--init-file=${sql}`,
  ]);
  const stop = async () => {
    if (process.child.exitCode === null) process.child.kill();
    await process.closed;
  };
  const config = { host: '127.0.0.1', port, user: 'root', password };
  try {
    await awaitReady(config);
    return { config, stop };
  } catch (error) {
    await stop();
    throw error;
  }
}
export async function outageFixture() {
  const parent = path.resolve('.local/mysql-outage');
  await mkdir(parent, { recursive: true });
  const root = await mkdtemp(path.join(parent, 'b8a1-'));
  const server = await startServer(root, await unusedPort());
  const name = `maozhi_test_${randomBytes(12).toString('hex')}`;
  const admin = openDatabase(server.config);
  await admin.run(`CREATE DATABASE \`${name}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_bin`);
  await admin.close();
  const db = openDatabase({ ...server.config, database: name });
  const dispose = async () => {
    await db.close();
    await server.stop();
    // Delete only the fresh private datadir created by this fixture, after its own child has exited.
    if (path.dirname(path.resolve(root)) !== parent || !path.basename(root).startsWith('b8a1-'))
      throw new Error('测试目录归属不符');
    await rm(root, { recursive: true, force: true });
  };
  try {
    await migrateUp(db);
    await seedDemo(db, 'maintenance-outage-test');
  } catch (error) {
    await dispose();
    throw error;
  }
  return { db, stop: server.stop, dispose };
}
