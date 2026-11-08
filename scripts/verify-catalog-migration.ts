import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createTestDatabase } from './mysql/test-database.ts';
import { seedFromSamples } from '../apps/api/src/db/seed.ts';
import { migrateUp } from '../apps/api/src/db/migrate.ts';
import { hash } from '../apps/api/src/shared/hash.ts';
import type { Database } from '../apps/api/src/db/mysql.ts';

async function fingerprint(db: Database) {
  const rows = [];
  for (const table of [
    'scan_facts',
    'scan_submissions',
    'outbound_orders',
    'outbound_lines',
    'stock',
    'operation_log',
    'idempotent_commands',
  ])
    rows.push((await db.all(`SELECT * FROM ${table}`)).map((r) => JSON.stringify(r)).sort());
  return hash(JSON.stringify(rows));
}
const { db, dispose } = await createTestDatabase('005_inventory_posting');
try {
  await seedFromSamples(db, 'isolated-catalog-migration-only');
  const before = await db.get(
    'SELECT COUNT(*) AS entries,COUNT(DISTINCT source_spec) AS specifications,SUM(weight_tonnes) AS tonnes FROM scan_catalog',
  );
  const catalogBefore = hash(JSON.stringify(await db.all('SELECT * FROM scan_catalog ORDER BY barcode'))),
    old = await fingerprint(db);
  await migrateUp(db);
  assert.equal(await fingerprint(db), old);
  assert.equal(hash(JSON.stringify(await db.all('SELECT * FROM scan_catalog ORDER BY barcode'))), catalogBefore);
  console.log(`B1C1_SAMPLE_BEFORE ${JSON.stringify(before)}`);
  const sql = readFileSync(new URL('./sql/verify-catalog-versioning.sql', import.meta.url), 'utf8');
  for (const query of sql
    .split(';')
    .map((s) => s.trim())
    .filter(Boolean))
    console.log(`B1C1_SAMPLE_SQL ${JSON.stringify(await db.all(query))}`);
  console.log('B1C1_SAMPLE v1_all_rows_equal=true facts_orders_stock_audit_idempotency_unchanged=true');
} finally {
  await dispose();
}
