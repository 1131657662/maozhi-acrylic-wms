import assert from 'node:assert/strict';
import { createReadStream, createWriteStream, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { randomBytes, randomUUID, createHash } from 'node:crypto';
import { spawn } from 'node:child_process';
import { finished } from 'node:stream/promises';
import { createConnection } from 'node:net';
import { developmentConfig } from '../apps/api/src/db/config.ts';
import { openDatabase, type Database } from '../apps/api/src/db/mysql.ts';
import { migrateUp, migrateDown } from '../apps/api/src/db/migrate.ts';
import { adminConfig, adminDatabase, quoteDatabase } from './mysql/local-config.ts';
import { createStocktake } from '../apps/api/src/features/stocktake/create.ts';
import { businessFingerprint } from '../apps/api/tests/lifecycle-fixture.ts';

async function assertApiStopped() {
  await new Promise<void>((resolve, reject) => {
    const socket = createConnection({ host: '127.0.0.1', port: 4310 });
    socket.once('connect', () => {
      socket.destroy();
      reject(new Error('请先停止本地 API 4310，再执行备份/迁移'));
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
async function counts(db: Database) {
  const result: Record<string, unknown> = {};
  for (const table of [
    'inbound_receipts',
    'outbound_orders',
    'stock',
    'stock_journal',
    'scan_facts',
    'catalog_entries',
  ])
    result[table] = (await db.get(`SELECT COUNT(*) AS n FROM ${table}`))?.n;
  return result;
}
async function upgradeAndCompare(db: Database, before: Record<string, string>) {
  await migrateUp(db, '009_stocktake');
  const after = await businessFingerprint(db);
  for (const table of Object.keys(before).filter((t) => t !== 'schema_migrations'))
    assert.equal(after[table], before[table], table);
  console.log(
    `B3A_MIGRATION business_tables_unchanged=${Object.keys(before).length - 1} counts=${JSON.stringify(await counts(db))}`,
  );
}

await assertApiStopped();
const config = developmentConfig(),
  admin = await adminDatabase();
if (!['maozhi_dev', 'maozhi_dev_sample'].includes(config.database))
  throw new Error('Only current local development database is allowed');
const source = openDatabase({ ...adminConfig(), database: config.database }),
  restoreName = `maozhi_restore_${randomBytes(12).toString('hex')}`;
let created = false;
mkdirSync('.local/backups', { recursive: true });
mkdirSync('.local/evidence', { recursive: true });
const path = `.local/backups/b3a-before-009-${Date.now()}.sql`;
try {
  assert.equal(
    (await source.get("SELECT value FROM app_meta WHERE meta_key='identity'"))?.value,
    'maozhi-local-mysql8-v1',
  );
  const before = await businessFingerprint(source);
  await transfer(config.database, path, 'dump');
  assert.deepEqual(await businessFingerprint(source), before, 'Source changed during backup; do not migrate');
  await admin.run(`CREATE DATABASE ${quoteDatabase(restoreName)} CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_bin`);
  created = true;
  await transfer(restoreName, path, 'restore');
  const restored = openDatabase({ ...adminConfig(), database: restoreName });
  try {
    assert.deepEqual(await businessFingerprint(restored), before, 'Restored rows differ');
    console.log(
      `B3A_RESTORE all_tables=${Object.keys(before).length} fingerprints_equal=true backup=${path} sha256=${createHash('sha256').update(readFileSync(path)).digest('hex')}`,
    );
    await upgradeAndCompare(restored, before);
    await migrateDown(restored);
    await migrateUp(restored, '009_stocktake');
    console.log('B3A_SAMPLE_EMPTY_DOWN success=true re_up=true historical_rows_preserved=true');
    const cell = await restored.get(`SELECT s.warehouse_code,s.product_code FROM stock s
      JOIN master_products p ON p.code=s.product_code AND p.source_kind='erp-product' AND p.source_del_flag=0
      JOIN master_warehouses w ON w.code=s.warehouse_code AND w.active=1 AND w.source_del_flag=0
      WHERE s.source_del_flag=0 AND s.packages>=0 AND s.weight_tonnes>=0 LIMIT 1`);
    assert(cell, 'Restored sample must contain one ERP inventory cell');
    const owner = await restored.get('SELECT username FROM owner LIMIT 1');
    assert(owner, 'Restored sample owner missing');
    await createStocktake(
      restored,
      { warehouseCode: String(cell.warehouse_code), productCodes: [String(cell.product_code)] },
      randomUUID(),
      { username: String(owner.username), traceId: randomUUID() },
    );
    const upgraded = await businessFingerprint(restored);
    let refusal = '';
    try {
      await migrateDown(restored);
    } catch (e) {
      refusal = String(e);
    }
    assert.match(refusal, /拒绝回退/);
    assert.deepEqual(await businessFingerprint(restored), upgraded);
    console.log(`B3A_SAMPLE_DOWN ${refusal} unchanged=true`);
  } finally {
    await restored.close();
  }
  if (process.argv.includes('--apply-local')) {
    await assertApiStopped();
    await upgradeAndCompare(source, before);
    console.log('B3A_LOCAL_009 applied=true');
  }
  writeFileSync(
    '.local/evidence/b3a-migration-fingerprints.json',
    JSON.stringify({ backup: path, before, after: await businessFingerprint(source) }, null, 2),
  );
} finally {
  await source.close();
  if (created) await admin.run(`DROP DATABASE ${quoteDatabase(restoreName)}`);
  await admin.close();
}
