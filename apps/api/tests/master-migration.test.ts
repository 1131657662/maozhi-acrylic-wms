import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createTestDatabase } from '../../../scripts/mysql/test-database.ts';
import { migrateDown, migrateUp } from '../src/db/migrate.ts';
import { tableFingerprints } from '../../../scripts/b4a-fingerprint.ts';
import { fixture } from './fixture.ts';
test('B6a 012 空库 up/down/up，只回退012', async () => {
  const c = await createTestDatabase('011_corrections_business_date');
  try {
    await migrateUp(c.db);
    assert.ok(await c.db.get("SHOW TABLES LIKE 'party_contacts'"));
    await migrateDown(c.db);
    assert.equal(await c.db.get("SHOW TABLES LIKE 'party_contacts'"), undefined);
    assert.ok(await c.db.get("SELECT id FROM schema_migrations WHERE id='011_corrections_business_date'"));
    await migrateUp(c.db);
    console.log(
      'B6A_MIGRATION',
      JSON.stringify({
        up: 'success',
        down: 'success',
        reUp: 'success',
        states: await c.db.all('SELECT id,state FROM schema_migrations ORDER BY id'),
      }),
    );
  } finally {
    await c.dispose();
  }
});
test('B6a 012 存量逐条映射、原值日期保持、非空down不变', async () => {
  const c = await fixture('011_corrections_business_date');
  try {
    for (const [code, source] of [
      ['EMPTY-APP', 'app'],
      ['USED-APP', 'app'],
      ['SPEC', 'sku-spec'],
      ['UNKNOWN', 'mystery'],
    ])
      await c.db.run(
        'INSERT INTO master_products(code,name,source_kind,created_at,updated_at) VALUES(?,?,?,UTC_TIMESTAMP(3),UTC_TIMESTAMP(3))',
        [code!, code!, source!],
      );
    await c.db.run(
      "INSERT INTO stock(warehouse_code,product_code,packages,weight_tonnes) VALUES('DEMO-WH','USED-APP',0,0)",
    );
    const before = await tableFingerprints(c.db);
    await migrateUp(c.db);
    const after = await tableFingerprints(c.db, before);
    for (const table of Object.keys(before).filter((name) => name !== 'schema_migrations'))
      assert.deepEqual(after[table], before[table], table);
    const rows = await c.db.all('SELECT code,origin_kind,inventory_eligible FROM master_products ORDER BY code');
    assert.deepEqual(
      rows.map((row) => [row.code, row.origin_kind, Number(row.inventory_eligible)]),
      [
        ['ACR-032', 'legacy', 1],
        ['EMPTY-APP', 'local', 1],
        ['SPEC', 'unknown', 0],
        ['UNKNOWN', 'unknown', 0],
        ['USED-APP', 'unknown', 0],
      ],
    );
    const post = await tableFingerprints(c.db);
    const ddl = await c.db.get('SHOW CREATE TABLE master_products');
    await assert.rejects(migrateDown(c.db), /拒绝回退/);
    assert.deepEqual(await tableFingerprints(c.db), post);
    assert.deepEqual(await c.db.get('SHOW CREATE TABLE master_products'), ddl);
    assert.equal(
      Number((await c.db.get('SELECT COUNT(*) AS n FROM outbound_orders WHERE business_date IS NOT NULL'))?.n),
      0,
    );
    console.log(
      'B6A_MIGRATION_NONEMPTY',
      JSON.stringify({
        rows,
        originalRowsUnchanged: true,
        oldDatesNull: true,
        down: 'refused',
        databaseUnchanged: true,
        report: await c.db.all('SELECT * FROM product_eligibility_migration ORDER BY product_code'),
      }),
    );
  } finally {
    await c.dispose();
  }
});
