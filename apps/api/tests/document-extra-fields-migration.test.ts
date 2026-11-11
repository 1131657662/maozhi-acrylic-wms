import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createTestDatabase } from '../../../scripts/mysql/test-database.ts';
import { migrateDown, migrateUp } from '../src/db/migrate.ts';
import { fixture } from './fixture.ts';

const tables = ['inbound_receipts', 'inbound_lines', 'outbound_orders', 'outbound_lines'];

test('017 空库 up/down/up 保持新增字段结构一致', async () => {
  const context = await createTestDatabase('016_outbound_shipments');
  try {
    await migrateUp(context.db);
    const before = await Promise.all(tables.map((table) => context.db.get(`SHOW CREATE TABLE \`${table}\``)));
    await migrateDown(context.db);
    for (const [table, column] of [
      ['inbound_receipts', 'bill_type'],
      ['inbound_lines', 'memo'],
      ['outbound_orders', 'container_no'],
      ['outbound_lines', 'contract_no'],
    ])
      assert.equal(await context.db.get(`SHOW COLUMNS FROM \`${table}\` LIKE '${column}'`), undefined);
    await migrateUp(context.db);
    assert.deepEqual(
      await Promise.all(tables.map((table) => context.db.get(`SHOW CREATE TABLE \`${table}\``))),
      before,
    );
  } finally {
    await context.dispose();
  }
});

test('017 新字段有值时在 DDL 前拒绝回退并保持结构', async () => {
  const context = await fixture();
  try {
    const before = await Promise.all(tables.map((table) => context.db.get(`SHOW CREATE TABLE \`${table}\``)));
    // Seeded outbound rows are historical; they must remain NULL after up.
    assert.equal((await context.db.get('SELECT bill_type FROM outbound_orders LIMIT 1'))?.bill_type, null);
    for (const column of ['bill_type', 'container_no']) {
      await context.db.run(`UPDATE outbound_orders SET ${column}=? LIMIT 1`, ['保留证据']);
      await assert.rejects(migrateDown(context.db), /单据扩展字段已有数据/);
      await context.db.run(`UPDATE outbound_orders SET ${column}=NULL`);
    }
    for (const column of ['contract_no', 'memo']) {
      await context.db.run(`UPDATE outbound_lines SET ${column}=? LIMIT 1`, ['保留证据']);
      await assert.rejects(migrateDown(context.db), /单据扩展字段已有数据/);
      await context.db.run(`UPDATE outbound_lines SET ${column}=NULL`);
    }
    assert.deepEqual(
      await Promise.all(tables.map((table) => context.db.get(`SHOW CREATE TABLE \`${table}\``))),
      before,
    );
    assert.equal(
      (await context.db.get("SELECT state FROM schema_migrations WHERE id='017_document_extra_fields'"))?.state,
      'applied',
    );
  } finally {
    await context.dispose();
  }
});
