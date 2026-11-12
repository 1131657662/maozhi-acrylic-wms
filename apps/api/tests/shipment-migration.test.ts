import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createTestDatabase } from '../../../scripts/mysql/test-database.ts';
import { migrateUp, migrateDown } from '../src/db/migrate.ts';
import { tableFingerprints } from '../../../scripts/b4a-fingerprint.ts';
import { fixture, actor } from './fixture.ts';
import { getOrder } from '../src/features/outbound/repository.ts';
import { confirmOutbound } from '../src/features/outbound/confirm.ts';
import { randomUUID } from 'node:crypto';
import { createOperation } from '../src/features/inventory/operation.ts';

test('016 empty up/down/up restores identical shipment schema', async () => {
  const c = await createTestDatabase('016_outbound_shipments');
  try {
    const before = await c.db.get('SHOW CREATE TABLE outbound_shipment_lines');
    const correctionSchema = await c.db.get('SHOW CREATE TABLE document_correction_lines');
    await migrateDown(c.db);
    assert.equal(await c.db.get("SHOW TABLES LIKE 'outbound_shipments'"), undefined);
    assert.equal(await c.db.get("SHOW COLUMNS FROM outbound_lines LIKE 'scan_packages'"), undefined);
    await migrateUp(c.db);
    assert.deepEqual(await c.db.get('SHOW CREATE TABLE outbound_shipment_lines'), before);
    assert.deepEqual(await c.db.get('SHOW CREATE TABLE document_correction_lines'), correctionSchema);
    console.log('B4D_MIGRATION empty=up/down/up structure_identical=true');
  } finally {
    await c.dispose();
  }
});

test('016 upgrades existing correction rows without changing evidence and refuses correction-only down', async () => {
  const c = await fixture('015_audit_attempts');
  try {
    const receiptId = randomUUID();
    await c.db.run(
      `INSERT INTO inbound_receipts(id,receipt_no,supplier_code,warehouse_code,memo,created_by,created_at,status,
        source_del_flag,posting_state,business_date,correction_revision)
       VALUES(?,'B4D-MIGRATION-RK','DEMO-SUPPLIER','DEMO-WH',NULL,'owner',UTC_TIMESTAMP(3),'pending',0,'pending',CURRENT_DATE,0)`,
      [receiptId],
    );
    const lineId = randomUUID();
    await c.db.run(
      `INSERT INTO inbound_lines(id,receipt_id,product_code,packages,weight_tonnes,source_del_flag)
       VALUES(?,?,'ACR-032',1,'0.1000',0)`,
      [lineId, receiptId],
    );
    const correctionId = randomUUID();
    const operation = await createOperation(c.db, 'stock.correct', correctionId, '旧版本合成更正', actor);
    await c.db.run(
      `INSERT INTO document_corrections(id,number,inbound_receipt_id,revision,reason,actor,created_at,operation_id)
      VALUES(?,'B4D-GZ-OLD',?,1,'旧版本合成更正','owner',UTC_TIMESTAMP(3),?)`,
      [correctionId, receiptId, operation.id],
    );
    await c.db.run(
      `INSERT INTO document_correction_lines(correction_id,product_code,inbound_line_id,
      packages_before,packages_after,tonnes_before,tonnes_after,packages_delta,tonnes_delta)
      VALUES(?,'ACR-032',?,2,3,'0.6000','0.6000',1,0)`,
      [correctionId, lineId],
    );
    const old = await c.db.get('SELECT * FROM document_correction_lines');
    await migrateUp(c.db, '017_document_extra_fields');
    const { original_line_id: migratedLineId, ...current } = (await c.db.get(
      'SELECT * FROM document_correction_lines',
    ))!;
    assert.equal(migratedLineId, lineId);
    assert.deepEqual(current, old);
    await migrateDown(c.db);
    const fingerprint = await tableFingerprints(c.db);
    const structure = await c.db.get('SHOW CREATE TABLE document_correction_lines');
    await assert.rejects(migrateDown(c.db), /document_correction_lines.*含有数据/);
    assert.deepEqual(await tableFingerprints(c.db), fingerprint);
    assert.deepEqual(await c.db.get('SHOW CREATE TABLE document_correction_lines'), structure);
    console.log(
      'B4D_MIGRATION existing_correction=preserved original_line_backfilled=true correction_only_down=refused structure_and_data_unchanged=true',
    );
  } finally {
    await c.dispose();
  }
});
test('016 nonempty down refuses before DDL and keeps structure and evidence', async () => {
  const c = await fixture('018_scan_workbench');
  try {
    const before = await getOrder(c.db, 'DEMO-001');
    await confirmOutbound(c.db, {
      planId: before.id,
      expected: before,
      key: randomUUID(),
      actor,
      lines: [{ lineId: before.lines[0]!.id, actualPackages: 1, actualWeightGrams: 200000 }],
    });
    await migrateDown(c.db); // 018: no counting provenance in this shipment-only fixture.
    await migrateDown(c.db);
    const fingerprints = await tableFingerprints(c.db);
    const structure = await c.db.get('SHOW CREATE TABLE outbound_lines');
    const statements: string[] = [];
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
    await assert.rejects(migrateDown(c.db), /拒绝回退/);
    assert.deepEqual(
      statements.filter((sql) => /^(CREATE|ALTER|DROP|TRUNCATE)/i.test(sql.trim())),
      [],
    );
    assert.deepEqual(await tableFingerprints(c.db), fingerprints);
    assert.deepEqual(await c.db.get('SHOW CREATE TABLE outbound_lines'), structure);
    console.log('B4D_MIGRATION nonempty=refused ddl=0 structure_and_data_unchanged=true');
  } finally {
    await c.dispose();
  }
});
