import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createTestDatabase } from '../../../scripts/mysql/test-database.ts';
import { migrateUp, migrateDown } from '../src/db/migrate.ts';
import { dateFixture, dateInput } from './date-correction-fixture.ts';
import { businessFingerprint } from './lifecycle-fixture.ts';

test('021 empty up/down/up preserves existing tables and installs date chain indexes', async () => {
  const c = await createTestDatabase('020_correction_shipment_line');
  try {
    const original = await c.db.get('SHOW CREATE TABLE inbound_receipts');
    await migrateUp(c.db);
    const schema = await c.db.get('SHOW CREATE TABLE document_date_corrections');
    const cols = await c.db.all(
      "SHOW COLUMNS FROM document_date_corrections WHERE Field IN ('before_date','after_date')",
    );
    assert.ok(cols.length === 2 && cols.every((col) => col.Null === 'NO'));
    await migrateDown(c.db);
    assert.equal(await c.db.get("SHOW TABLES LIKE 'document_date_corrections'"), undefined);
    assert.deepEqual(await c.db.get('SHOW CREATE TABLE inbound_receipts'), original);
    await migrateUp(c.db);
    assert.deepEqual(await c.db.get('SHOW CREATE TABLE document_date_corrections'), schema);
    console.log('B5D1_MIGRATION empty=up/down/up original_schema_unchanged=true');
  } finally {
    await c.dispose();
  }
});
test('021 records cannot be updated/deleted; nonempty down rejects before any DDL', async () => {
  const c = await dateFixture();
  try {
    await c.send(dateInput()).expect(200);
    await assert.rejects(c.db.run("UPDATE document_date_corrections SET reason='replace'"), /immutable/);
    await assert.rejects(c.db.run('DELETE FROM document_date_corrections'), /immutable/);
    const before = await businessFingerprint(c.db),
      statements: string[] = [];
    const withConnection = c.db.withConnection.bind(c.db);
    c.db.withConnection = (work) =>
      withConnection(async (connection) => {
        const run = connection.run.bind(connection);
        connection.run = (sql, values) => {
          statements.push(sql);
          return run(sql, values);
        };
        return work(connection);
      });
    await assert.rejects(migrateDown(c.db), /document_date_corrections 含有数据/);
    assert.deepEqual(
      statements.filter((sql) => /^(CREATE|ALTER|DROP|TRUNCATE)/i.test(sql.trim())),
      [],
    );
    assert.deepEqual(await businessFingerprint(c.db), before);
    const plan = await c.db.all(
      'EXPLAIN SELECT after_date FROM document_date_corrections WHERE document_kind=? AND document_id=? ORDER BY revision DESC LIMIT 1',
      ['inbound', c.target.id],
    );
    assert.equal(plan[0]?.key, 'date_correction_version');
    console.log('B5D1_MIGRATION nonempty=refused ddl=0 unchanged=true index=date_correction_version');
  } finally {
    await c.dispose();
  }
});
