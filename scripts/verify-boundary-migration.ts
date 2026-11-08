import assert from 'node:assert/strict';
import { createReadStream, createWriteStream, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { randomBytes } from 'node:crypto';
import { spawn } from 'node:child_process';
import { finished } from 'node:stream/promises';
import { createConnection } from 'node:net';
import { developmentConfig } from '../apps/api/src/db/config.ts';
import { openDatabase } from '../apps/api/src/db/mysql.ts';
import { migrateUp } from '../apps/api/src/db/migrate.ts';
import { assertBoundaryReady } from '../apps/api/src/db/boundary-readiness.ts';
import { adminConfig, adminDatabase, quoteDatabase } from './mysql/local-config.ts';
import { sha256, tableFingerprints } from './b4a-fingerprint.ts';

async function assertApiStopped() {
  await new Promise<void>((resolve, reject) => {
    const socket = createConnection({ host: '127.0.0.1', port: 4310 });
    socket.once('connect', () => {
      socket.destroy();
      reject(new Error('请先停止本地 API 4310'));
    });
    socket.once('error', (error: NodeJS.ErrnoException) => (error.code === 'ECONNREFUSED' ? resolve() : reject(error)));
  });
}
async function transfer(database: string, path: string, direction: 'dump' | 'restore') {
  const config = adminConfig(),
    common = ['--host', config.host, '--port', String(config.port), '--user', config.user];
  const child = spawn(
    direction === 'dump' ? 'mysqldump' : 'mysql',
    direction === 'dump'
      ? [...common, '--single-transaction', '--skip-lock-tables', '--hex-blob', '--skip-routines', database]
      : [...common, database],
    { env: { ...process.env, MYSQL_PWD: config.password }, stdio: ['pipe', 'pipe', 'pipe'] },
  );
  let error = '';
  child.stderr.on('data', (data) => {
    error += String(data);
  });
  const stream =
    direction === 'dump'
      ? child.stdout.pipe(createWriteStream(path, { flags: 'wx' }))
      : createReadStream(path).pipe(child.stdin);
  if (direction === 'dump') child.stdin.end();
  await Promise.all([
    finished(stream),
    new Promise<void>((resolve, reject) => {
      child.once('error', reject);
      child.once('close', (code) => (code === 0 ? resolve() : reject(new Error(error))));
    }),
  ]);
}

await assertApiStopped();
const config = developmentConfig();
assert.equal(config.host, '127.0.0.1');
assert.equal(config.port, 3307);
assert(['maozhi_dev', 'maozhi_dev_sample'].includes(config.database));
const admin = await adminDatabase(),
  source = openDatabase({ ...adminConfig(), database: config.database });
const restoreName = `maozhi_restore_${randomBytes(12).toString('hex')}`;
const stamp = Date.now(),
  backup = `.local/backups/b4a-before-010-${stamp}.sql`,
  evidence = `.local/evidence/b4a-migration-${stamp}.json`;
mkdirSync('.local/backups', { recursive: true });
mkdirSync('.local/evidence', { recursive: true });
let created = false;
try {
  assert.equal(
    (await source.get("SELECT value FROM app_meta WHERE meta_key='identity'"))?.value,
    'maozhi-local-mysql8-v1',
  );
  assert.equal((await source.get("SELECT state FROM schema_migrations WHERE id='009_stocktake'"))?.state, 'applied');
  assert.equal(
    await source.get("SELECT id FROM schema_migrations WHERE id='010_outbound_memo'"),
    undefined,
    '010 already exists; do not overwrite prior evidence',
  );
  const before = await tableFingerprints(source);
  await transfer(config.database, backup, 'dump');
  assert.deepEqual(await tableFingerprints(source), before, 'Source changed during backup');
  const manifest = {
    database: config.database,
    host: config.host,
    port: config.port,
    backup,
    backupSha256: sha256(readFileSync(backup)),
    before,
  };
  writeFileSync(evidence, JSON.stringify(manifest, null, 2));
  await admin.run(`CREATE DATABASE ${quoteDatabase(restoreName)} CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_bin`);
  created = true;
  await transfer(restoreName, backup, 'restore');
  const restored = openDatabase({ ...adminConfig(), database: restoreName });
  try {
    assert.deepEqual(await tableFingerprints(restored), before, 'Backup restore differs');
  } finally {
    await restored.close();
  }
  await assertApiStopped();
  assert.deepEqual(await tableFingerprints(source), before, 'Source changed before migration');
  await migrateUp(source, '010_outbound_memo');
  await assertBoundaryReady(source);
  const after = await tableFingerprints(source),
    afterOriginalColumns = await tableFingerprints(source, before);
  for (const table of Object.keys(before).filter((name) => name !== 'schema_migrations'))
    assert.deepEqual(afterOriginalColumns[table], before[table], table);
  const nonNullMemos = Number(
    (await source.get('SELECT COUNT(*) AS n FROM outbound_orders WHERE memo IS NOT NULL'))?.n,
  );
  assert.equal(nonNullMemos, 0);
  writeFileSync(
    evidence,
    JSON.stringify(
      {
        ...manifest,
        after,
        afterOriginalColumns,
        nonNullMemos,
        restoredBackupVerified: true,
        appliedAt: new Date().toISOString(),
      },
      null,
      2,
    ),
  );
  console.log(
    'B4A_LOCAL_010',
    JSON.stringify({
      database: config.database,
      port: config.port,
      migration: 'applied',
      businessTablesUnchanged: Object.keys(before).length - 1,
      backup,
      backupSha256: manifest.backupSha256,
      evidence,
      nonNullMemos,
      restoredBackupVerified: true,
    }),
  );
} finally {
  await source.close();
  if (created) await admin.run(`DROP DATABASE ${quoteDatabase(restoreName)}`);
  await admin.close();
}
