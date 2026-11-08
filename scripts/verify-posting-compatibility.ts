import assert from 'node:assert/strict';
import { createHash, randomUUID } from 'node:crypto';
import { createTestDatabase } from './mysql/test-database.ts';
import { migrateDown, migrateUp } from '../apps/api/src/db/migrate.ts';
import { seedFromSamples } from '../apps/api/src/db/seed.ts';
import { journalFields, journalItem, journalOperationJoin } from '../apps/api/src/features/stock/journal-row.ts';
import { confirmInbound } from '../apps/api/src/features/inbound/confirm.ts';
import { confirmOutbound } from '../apps/api/src/features/outbound/confirm.ts';
import type { Database } from '../apps/api/src/db/mysql.ts';

async function digest(db: Database) {
  const snapshots = await Promise.all([
    db.all('SELECT id,status,source_id FROM inbound_receipts ORDER BY id'),
    db.all('SELECT id,status,source_id FROM outbound_orders ORDER BY id'),
    db.all('SELECT * FROM stock ORDER BY warehouse_code,product_code,source_del_flag'),
    db.all('SELECT id,packages_delta,tonnes_delta,source_business_type,source_row_json FROM stock_journal ORDER BY id'),
  ]);
  return createHash('sha256').update(JSON.stringify(snapshots)).digest('hex');
}
const { db, dispose } = await createTestDatabase();
try {
  await migrateDown(db);
  await seedFromSamples(db, 'compatibility-isolated-test-only');
  const before = await digest(db);
  await migrateUp(db);
  assert.equal(await digest(db), before);
  const inbound = await db.all(
    'SELECT status,posting_state,COUNT(*) AS rows_count FROM inbound_receipts GROUP BY status,posting_state',
  );
  const outbound = await db.all('SELECT status,COUNT(*) AS rows_count FROM outbound_orders GROUP BY status');
  const rows = await db.all(`SELECT ${journalFields} FROM stock_journal j ${journalOperationJoin}`);
  const journals = rows.map(journalItem);
  const complete = journals.filter((row) => row.before && row.after && row.operationId && row.operationType != null);
  const balanced = complete.filter(
    (row) =>
      row.after!.packages - row.before!.packages === row.packagesDelta &&
      row.after!.weightGrams - row.before!.weightGrams === row.weightDeltaGrams,
  );
  assert.equal(complete.length, rows.length);
  assert.equal(balanced.length, rows.length);
  const actor = { username: 'owner', traceId: 'isolated-compatibility' };
  const receipt = await db.get('SELECT id FROM inbound_receipts WHERE source_del_flag=0 LIMIT 1');
  const order = await db.get('SELECT id FROM outbound_orders WHERE source_del_flag=0 LIMIT 1');
  await assert.rejects(confirmInbound(db, String(receipt?.id), randomUUID(), actor), { code: 'LEGACY_RECEIPT' });
  await assert.rejects(
    confirmOutbound(db, {
      planId: String(order?.id),
      key: randomUUID(),
      actor,
      expected: { revision: 0, digest: '0'.repeat(64) },
    }),
    { code: 'LEGACY_ORDER' },
  );
  assert.equal(await digest(db), before);
  console.log(
    JSON.stringify(
      {
        isolatedMysqlPort: 3307,
        migration: '005',
        unchangedHistoryAndStock: true,
        inbound,
        outbound,
        journalRows: rows.length,
        completeEvidence: complete.length,
        deltaMatches: balanced.length,
        historicalReconfirmationRejected: true,
      },
      null,
      2,
    ),
  );
} finally {
  await dispose();
}
