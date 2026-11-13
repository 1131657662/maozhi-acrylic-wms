import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createTestDatabase } from '../../../scripts/mysql/test-database.ts';
import { migrateDown, migrateUp } from '../src/db/migrate.ts';
import { correctionFixture } from './correction-fixture.ts';
import { shipmentCorrectionFixture, correctionInput } from './shipment-correction-fixture.ts';

test('020 empty up/down/up preserves structure and installs a nullable indexed FK', async () => {
  const c = await createTestDatabase('019_shipment_close');
  try {
    const before = await c.db.get('SHOW CREATE TABLE document_correction_lines');
    await migrateUp(c.db, '020_correction_shipment_line');
    const after = await c.db.get('SHOW CREATE TABLE document_correction_lines');
    const column = await c.db.get("SHOW COLUMNS FROM document_correction_lines LIKE 'shipment_line_id'");
    assert.equal(column?.Null, 'YES');
    assert.equal(column?.Type, 'bigint unsigned');
    await migrateDown(c.db);
    assert.deepEqual(await c.db.get('SHOW CREATE TABLE document_correction_lines'), before);
    await migrateUp(c.db, '020_correction_shipment_line');
    assert.deepEqual(await c.db.get('SHOW CREATE TABLE document_correction_lines'), after);
    console.log('B5C2_MIGRATION empty=up/down/up structure_equal=true nullable_fk=true');
  } finally {
    await c.dispose();
  }
});

test('020 multiple shipments or unmatched original lines stay NULL, legacy order-line correction remains reversible', async () => {
  const c = await shipmentCorrectionFixture();
  try {
    // Reconstruct the B5a aggregate quantities instead of pretending a per-shipment before value is legacy.
    await c.send(`${c.path}/corrections`, await correctionInput(c, 2, 50)).expect(200);
    await c.db.run(`UPDATE document_correction_lines SET shipment_line_id=NULL,packages_before=100,
      packages_after=90,tonnes_before='30.0000',tonnes_after='27.0000'`);
    const before = (await c.current()).corrections!.effective;
    for (const table of ['master_products', 'master_customers', 'master_suppliers', 'master_vehicles'])
      await c.db.run(`UPDATE ${table} SET search_text=NULL`);
    await migrateDown(c.db); // 022: restore the pre-search-text migration state.
    await migrateDown(c.db); // 021 is empty; remove it before exercising 020.
    await migrateDown(c.db);
    await migrateUp(c.db);
    assert.equal((await c.db.get('SELECT shipment_line_id FROM document_correction_lines'))?.shipment_line_id, null);
    assert.deepEqual((await c.current()).corrections!.effective, before);
    const preview = (await c.web.get(`/api/v1${c.path}/lifecycle`).expect(200)).body.data;
    assert.equal(preview.allowed, true);
    await c.send(`${c.path}/reverse`, { reason: '旧更正仍可撤销', expectedToken: preview.token }).expect(200);
    assert.equal((await c.db.get("SELECT packages FROM stock WHERE product_code='ACR-032'"))?.packages, 200);
    // A header pointing at an order without a matching shipment must not be guessed from another order's line.
    await c.db.run("UPDATE document_corrections SET outbound_order_id='DEMO-001'");
    await migrateDown(c.db); // 022 is empty after migration reapply.
    await migrateDown(c.db); // 021 is empty; remove it before exercising 020.
    await migrateDown(c.db);
    await migrateUp(c.db);
    assert.equal((await c.db.get('SELECT shipment_line_id FROM document_correction_lines'))?.shipment_line_id, null);
    console.log('B5C2_MIGRATION multiple=NULL unmatched=NULL legacy_effective=90 reverse_stock=200');
  } finally {
    await c.dispose();
  }
});

test('020 backfills one shipment without changing effective amounts; non-null refuses before DDL', async () => {
  const c = await correctionFixture('outbound');
  try {
    await c.post(await c.input()).expect(200);
    const before = (await c.detail()).body.data.corrections.effective;
    await c.db.run('UPDATE document_correction_lines SET shipment_line_id=NULL');
    for (const table of ['master_products', 'master_customers', 'master_suppliers', 'master_vehicles'])
      await c.db.run(`UPDATE ${table} SET search_text=NULL`);
    await migrateDown(c.db); // 022: restore the pre-search-text migration state.
    await migrateDown(c.db); // 021 is empty; remove it before exercising 020.
    await migrateDown(c.db);
    await migrateUp(c.db);
    assert.deepEqual((await c.detail()).body.data.corrections.effective, before);
    assert.ok((await c.db.get('SELECT shipment_line_id FROM document_correction_lines'))?.shipment_line_id);
    await migrateDown(c.db); // 022 was re-added as empty.
    await migrateDown(c.db); // Remove empty 021 before observing the 020 guard.
    const schema = await c.db.get('SHOW CREATE TABLE document_correction_lines');
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
    await assert.rejects(migrateDown(c.db), /拒绝回退.*发货行/);
    assert.deepEqual(
      statements.filter((sql) => /^(CREATE|ALTER|DROP|TRUNCATE)/i.test(sql.trim())),
      [],
    );
    assert.deepEqual(await c.db.get('SHOW CREATE TABLE document_correction_lines'), schema);
    assert.equal(
      (await c.db.get("SELECT state FROM schema_migrations WHERE id='020_correction_shipment_line'"))?.state,
      'applied',
    );
    const plan = await c.db.all(
      'EXPLAIN SELECT correction_id FROM document_correction_lines WHERE shipment_line_id=?',
      [String((await c.db.get('SELECT shipment_line_id FROM document_correction_lines'))!.shipment_line_id)],
    );
    assert.equal(plan[0]?.key, 'idx_correction_shipment_line');
    console.log(
      'B5C2_MIGRATION single_backfill=true effective_before_after=' +
        JSON.stringify(before) +
        ' nonnull_down=refused ddl=0 structure_equal=true',
    );
    console.log('B5C2_INDEX', JSON.stringify(plan));
  } finally {
    await c.dispose();
  }
});
