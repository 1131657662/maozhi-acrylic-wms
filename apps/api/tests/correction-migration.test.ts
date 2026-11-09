import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createTestDatabase } from '../../../scripts/mysql/test-database.ts';
import { migrateDown, migrateUp } from '../src/db/migrate.ts';
import { assertCorrectionsReady } from '../src/db/correction-migration.ts';
import { fixture } from './fixture.ts';
import { correctionFixture } from './correction-fixture.ts';
import { businessFingerprint } from './lifecycle-fixture.ts';

test('B5a 011 空库up/down/up与旧模式拒绝启动', async () => {
  const c = await createTestDatabase('010_outbound_memo');
  try {
    await assert.rejects(assertCorrectionsReady(c.db), /011/);
    await migrateUp(c.db);
    await assertCorrectionsReady(c.db);
    console.log(
      'B5A_MIGRATION_UP',
      JSON.stringify(await c.db.get("SELECT id,state FROM schema_migrations WHERE id='011_corrections_business_date'")),
    );
    await migrateDown(c.db);
    await assert.rejects(assertCorrectionsReady(c.db), /011/);
    assert.equal(await c.db.get("SHOW TABLES LIKE 'document_corrections'"), undefined);
    console.log(
      'B5A_MIGRATION_DOWN',
      JSON.stringify({
        migrations: await c.db.all("SELECT id,state FROM schema_migrations WHERE id='011_corrections_business_date'"),
        tables: await c.db.all("SHOW TABLES LIKE 'document_corrections'"),
      }),
    );
    await migrateUp(c.db);
    await assertCorrectionsReady(c.db);
    console.log('B5A_MIGRATION 011 up=success empty_down=success re_up=success old_schema_start=refused');
  } finally {
    await c.dispose();
  }
});

test('B5a 011 仅业务日期非空也拒绝down且库不变', async () => {
  const c = await fixture();
  try {
    await c.db.run("UPDATE outbound_orders SET business_date='2026-11-09' WHERE id='DEMO-001'");
    const before = await businessFingerprint(c.db);
    let message = '';
    try {
      await migrateDown(c.db);
    } catch (error) {
      message = String(error);
    }
    assert.match(message, /拒绝回退.*outbound_orders/);
    assert.deepEqual(await businessFingerprint(c.db), before);
    console.log('B5A_MIGRATION_DATE_GUARD', JSON.stringify({ output: message, databaseUnchanged: true }));
  } finally {
    await c.dispose();
  }
});
test('B5a 011 非空旧库升级原行不变，日期未知不回填', async () => {
  const c = await fixture('010_outbound_memo');
  try {
    const before = await c.db.all('SELECT * FROM outbound_orders ORDER BY id');
    await migrateUp(c.db);
    const after = await c.db.all('SELECT * FROM outbound_orders ORDER BY id');
    assert.deepEqual(
      after.map(({ business_date, correction_revision, ...row }) => {
        assert.equal(business_date, null);
        assert.equal(correction_revision, 0);
        return row;
      }),
      before,
    );
    console.log('B5A_MIGRATION 011 existing_rows=unchanged business_date=NULL correction_revision=0');
  } finally {
    await c.dispose();
  }
});
test('B5a 011 非空更正拒绝down，所有行与schema不变', async () => {
  const c = await correctionFixture();
  try {
    await c.post(await c.input()).expect(200);
    const before = await businessFingerprint(c.db);
    const ddlBefore = await c.db.get('SHOW CREATE TABLE document_corrections');
    let message = '';
    try {
      await migrateDown(c.db);
    } catch (error) {
      message = String(error);
    }
    assert.match(message, /拒绝回退.*document_corrections/);
    assert.deepEqual(await businessFingerprint(c.db), before);
    assert.deepEqual(await c.db.get('SHOW CREATE TABLE document_corrections'), ddlBefore);
    console.log('B5A_MIGRATION', JSON.stringify({ nonemptyDown: message, databaseUnchanged: true, noDDL: true }));
  } finally {
    await c.dispose();
  }
});
