import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createTestDatabase } from '../../../scripts/mysql/test-database.ts';
import { migrateUp, migrateDown } from '../src/db/migrate.ts';
import { fixture } from './fixture.ts';

test('019 empty up/down/up adds only four nullable columns and preserves schema', async () => {
  const c = await createTestDatabase('018_scan_workbench');
  try {
    const before = await c.db.get('SHOW CREATE TABLE outbound_orders');
    await migrateUp(c.db, '019_shipment_close');
    const after = await c.db.get('SHOW CREATE TABLE outbound_orders');
    const cols = await c.db.all("SHOW COLUMNS FROM outbound_orders WHERE Field LIKE 'short_clos%'");
    assert.equal(cols.length, 4);
    assert.ok(cols.every((col) => col.Null === 'YES' && col.Default === null));
    await migrateDown(c.db);
    assert.deepEqual(await c.db.get('SHOW CREATE TABLE outbound_orders'), before);
    await migrateUp(c.db, '019_shipment_close');
    assert.deepEqual(await c.db.get('SHOW CREATE TABLE outbound_orders'), after);
    console.log('B5C1_MIGRATION empty=up/down/up nullable_columns=4 identical_schema=true');
  } finally {
    await c.dispose();
  }
});

test('019 each non-null short-close field, including zero, blocks down before any DDL', async () => {
  const c = await fixture('019_shipment_close');
  try {
    const before = await c.db.get('SHOW CREATE TABLE outbound_orders');
    const cases = [
      'short_closed_at=UTC_TIMESTAMP(3)',
      "short_close_reason=''",
      'short_closed_packages=0',
      'short_closed_grams=0',
    ];
    const statements: string[] = [],
      withConnection = c.db.withConnection.bind(c.db);
    c.db.withConnection = (work) =>
      withConnection(async (connection) => {
        const run = connection.run.bind(connection);
        connection.run = (sql, values) => {
          statements.push(sql);
          return run(sql, values);
        };
        return work(connection);
      });
    for (const field of cases) {
      await c.db.run(
        `UPDATE outbound_orders SET short_closed_at=NULL,short_close_reason=NULL,short_closed_packages=NULL,short_closed_grams=NULL,${field} WHERE id='DEMO-001'`,
      );
      statements.length = 0;
      await assert.rejects(migrateDown(c.db), /拒绝回退.*短关证据/);
      assert.deepEqual(
        statements.filter((sql) => /^(CREATE|ALTER|DROP|TRUNCATE)/i.test(sql.trim())),
        [],
      );
      assert.deepEqual(await c.db.get('SHOW CREATE TABLE outbound_orders'), before);
      assert.equal(
        (await c.db.get("SELECT state FROM schema_migrations WHERE id='019_shipment_close'"))?.state,
        'applied',
      );
    }
    console.log('B5C1_MIGRATION nonnull_fields=4 refused=4 ddl=0 schema_unchanged=true');
  } finally {
    await c.dispose();
  }
});
