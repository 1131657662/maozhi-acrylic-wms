import assert from 'node:assert/strict';
import { createReadStream, createWriteStream, mkdirSync, readFileSync } from 'node:fs';
import { randomBytes, createHash } from 'node:crypto';
import { spawn } from 'node:child_process';
import { finished } from 'node:stream/promises';
import { createTestDatabase } from './mysql/test-database.ts';
import { adminConfig, adminDatabase, quoteDatabase } from './mysql/local-config.ts';
import { openDatabase, type Database } from '../apps/api/src/db/mysql.ts';
import { seedDemo } from '../apps/api/src/db/seed-test.ts';
import { upload, publish, fact, actor } from '../apps/api/tests/catalog-fixture.ts';
import { recordFact } from '../apps/api/src/features/scan/service.ts';
import { readEntries } from '../apps/api/src/features/catalog/repository.ts';
import { contentHash, bytesHash } from '../apps/api/src/features/catalog/hash.ts';

async function sqlTransfer(database: string, path: string, direction: 'dump' | 'restore') {
  const config = adminConfig();
  const common = ['--host', config.host, '--port', String(config.port), '--user', config.user];
  const args =
    direction === 'dump'
      ? [...common, '--single-transaction', '--skip-lock-tables', '--hex-blob', '--skip-routines', database]
      : [...common, database];
  const child = spawn(direction === 'dump' ? 'mysqldump' : 'mysql', args, {
    env: { ...process.env, MYSQL_PWD: config.password },
    stdio: ['pipe', 'pipe', 'pipe'],
  });
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
async function fingerprint(db: Database) {
  const values = [];
  for (const table of [
    'catalog_versions',
    'catalog_entries',
    'catalog_head',
    'scan_fact_context',
    'scan_facts',
    'scan_submissions',
    'outbound_orders',
    'outbound_lines',
    'operation_log',
    'idempotent_commands',
  ])
    values.push((await db.all(`SELECT * FROM ${table}`)).map((row) => JSON.stringify(row)).sort());
  return createHash('sha256').update(JSON.stringify(values)).digest('hex');
}
async function verifySourceBytes(db: Database) {
  for (const row of await db.all('SELECT version_id,source_bytes,source_sha256,content_sha256 FROM catalog_versions')) {
    assert(Buffer.isBuffer(row.source_bytes));
    assert.equal(bytesHash(row.source_bytes), row.source_sha256);
    assert.equal(contentHash(await readEntries(db, Number(row.version_id))), row.content_sha256);
  }
}
const { db, name, dispose } = await createTestDatabase();
const restoreName = `maozhi_restore_${randomBytes(12).toString('hex')}`;
const admin = await adminDatabase();
mkdirSync('.local/backups', { recursive: true });
const path = `.local/backups/catalog-drill-${Date.now()}.sql`;
try {
  await seedDemo(db, 'isolated-restore-test');
  await recordFact(db, { planId: 'DEMO-001', fact: fact(), actor });
  const candidate = (await upload(db, '恢复演练规格 RESTORE-A 297.5')).version!;
  await publish(db, candidate.versionId);
  await recordFact(db, {
    planId: 'DEMO-001',
    fact: fact({ barcode: 'RESTORE-A', weightGrams: 297500, catalogVersion: 2 }),
    context: { outboundLineId: 'DEMO-001-L1', sourceSpec: '恢复演练规格', resolvedAt: null },
    actor,
  });
  const before = await fingerprint(db);
  await sqlTransfer(name, path, 'dump');
  await admin.run(`CREATE DATABASE ${quoteDatabase(restoreName)} CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_bin`);
  await sqlTransfer(restoreName, path, 'restore');
  const restored = openDatabase({ ...adminConfig(), database: restoreName });
  try {
    assert.equal(await fingerprint(restored), before);
    await verifySourceBytes(restored);
    console.log(
      'B1C1_RESTORE versions=2 facts=2 mixed_versions=[1,2] source_bytes_sha=equal content_sha=equal all_rows=equal',
    );
    console.log(`B1C1_RESTORE artifact=${path} backup_sha256=${bytesHash(readFileSync(path))}`);
  } finally {
    await restored.close();
  }
} finally {
  await admin.run(`DROP DATABASE IF EXISTS ${quoteDatabase(restoreName)}`);
  await admin.close();
  await dispose();
}
