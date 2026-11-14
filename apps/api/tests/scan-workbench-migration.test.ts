import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createTestDatabase } from '../../../scripts/mysql/test-database.ts';
import { migrateUp, migrateDown } from '../src/db/migrate.ts';
import { countingFixture } from './scan-workbench-fixture.ts';
import { fixture } from './fixture.ts';

test('018 empty up/down/up restores schema; captures empty-fixture query plans', async () => {
  const c = await createTestDatabase('017_document_extra_fields');
  try {
    const beforePlan = await c.db.all("EXPLAIN SELECT id FROM scan_facts WHERE plan_id='test' AND barcode='test'");
    await migrateUp(c.db, '018_scan_workbench');
    const schema = await c.db.get('SHOW CREATE TABLE scan_facts');
    const afterPlan = await c.db.all("EXPLAIN SELECT id FROM scan_facts WHERE plan_id='test' AND barcode='test'");
    await migrateDown(c.db);
    assert.equal(await c.db.get("SHOW COLUMNS FROM scan_facts LIKE 'attribution'"), undefined);
    await migrateUp(c.db, '018_scan_workbench');
    assert.deepEqual(await c.db.get('SHOW CREATE TABLE scan_facts'), schema);
    console.log(
      'B4G_018 empty=up/down/up explain_empty_fixture=' + JSON.stringify({ before: beforePlan, after: afterPlan }),
    );
  } finally {
    await c.dispose();
  }
});

test('018 down refuses new evidence before DDL without changing schema', async () => {
  const c = await countingFixture();
  try {
    await c.post({ barcode: 'DEMO-032-11', productCode: 'ACR-032', source: 'manual' }).expect(200);
    for (const table of ['master_products', 'master_customers', 'master_suppliers', 'master_vehicles'])
      await c.db.run(`UPDATE ${table} SET search_text=NULL`);
    await migrateDown(c.db); // Remove empty 024 before testing the 018 evidence guard.
    await migrateDown(c.db); // Remove empty 023 before testing the 018 evidence guard.
    await migrateDown(c.db); // Remove 022 before testing the 018 evidence guard.
    await migrateDown(c.db); // Empty 021 date corrections, then 020 and 019 before the intended 018 guard.
    await migrateDown(c.db);
    await migrateDown(c.db);
    const plan = await c.db.all("EXPLAIN SELECT id FROM scan_facts WHERE plan_id='DEMO-001' AND barcode='DEMO-032-11'");
    assert.equal(plan[0]?.key, 'fact_order_barcode');
    console.log('B4G_018 populated_lookup=' + JSON.stringify(plan));
    const before = await c.db.get('SHOW CREATE TABLE scan_facts');
    await assert.rejects(migrateDown(c.db), /拒绝回退.*清点记录/);
    assert.deepEqual(await c.db.get('SHOW CREATE TABLE scan_facts'), before);
    assert.equal(
      (await c.db.get("SELECT state FROM schema_migrations WHERE id='018_scan_workbench'"))?.state,
      'applied',
    );
  } finally {
    await c.dispose();
  }
});

test('018 preserves historical NULL provenance and refuses global-unique restoration with cross-order duplicates', async () => {
  const c = await fixture('017_document_extra_fields');
  try {
    await c.db
      .run(`INSERT INTO scan_facts(id,plan_id,barcode,weight_tonnes,catalog_version,weight_source,device_id,scanned_at,received_at,recorded_by,payload_hash)
      VALUES(UUID(),'DEMO-001','DEMO-032-11','0.3025',1,'catalog','old',UTC_TIMESTAMP(3),UTC_TIMESTAMP(3),'owner',REPEAT('a',64))`);
    const original = await c.db.all('SELECT * FROM scan_facts');
    await migrateUp(c.db, '018_scan_workbench');
    const { source, attribution, revoked_at, revoked_by, ...row } = (await c.db.get('SELECT * FROM scan_facts'))!;
    assert.deepEqual([source, attribution, revoked_at, revoked_by], [null, null, null, null]);
    assert.deepEqual(row, original[0]);
    await c.db
      .run(`INSERT INTO scan_facts(id,plan_id,barcode,weight_tonnes,catalog_version,weight_source,device_id,scanned_at,received_at,recorded_by,payload_hash)
      SELECT UUID(),'DEMO-002',barcode,weight_tonnes,catalog_version,weight_source,device_id,scanned_at,received_at,recorded_by,payload_hash FROM scan_facts LIMIT 1`);
    const before = await c.db.get('SHOW CREATE TABLE scan_facts');
    await assert.rejects(migrateDown(c.db), /拒绝回退.*跨单条码/);
    assert.deepEqual(await c.db.get('SHOW CREATE TABLE scan_facts'), before);
  } finally {
    await c.dispose();
  }
});
