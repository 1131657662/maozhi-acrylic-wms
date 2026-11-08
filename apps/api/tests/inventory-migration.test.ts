import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createTestDatabase } from '../../../scripts/mysql/test-database.ts';
import { migrateDown, migrateUp } from '../src/db/migrate.ts';
import { seedDemo } from '../src/db/seed-test.ts';
import { fixture, actor } from './fixture.ts';
import { inventorySnapshot } from './inventory-fixture.ts';
import { createOperation } from '../src/features/inventory/operation.ts';
import type { Database } from '../src/db/mysql.ts';
import { audit } from '../src/shared/audit.ts';

async function seedPosted005Adjustment(db: Database) {
  // A populated historical schema fixture; current write services require 009 and are tested separately.
  await db.transaction(async (tx) => {
    const operation = await createOperation(tx, 'stock.adjust', 'DEMO-WH/ACR-032', '迁移保护夹具', actor);
    await tx.run(
      "UPDATE stock SET packages=5,weight_tonnes='1.5897' WHERE warehouse_code='DEMO-WH' AND product_code='ACR-032'",
    );
    await tx.run(
      `INSERT INTO stock_journal(operation_id,warehouse_code,product_code,packages_delta,tonnes_delta,
      packages_before,packages_after,tonnes_before,tonnes_after,created_at)
      VALUES(?,'DEMO-WH','ACR-032',-1,'-0.2103',6,5,'1.8000','1.5897',UTC_TIMESTAMP(3))`,
      [operation.id],
    );
    await audit(tx, actor, {
      action: 'stock.adjust',
      targetId: operation.targetId,
      before: { packages: 6, weightGrams: 1800000 },
      after: { packages: 5, weightGrams: 1589700 },
    });
    await tx.run('INSERT INTO idempotent_commands(command_key,payload_hash,result_json) VALUES(?,?,?)', [
      'stock.adjust:migration-fixture',
      '0'.repeat(64),
      JSON.stringify({ operationId: operation.id }),
    ]);
  });
}

test('005 空表 down/up，历史非空无改状态地升级，非空 down 拒绝', async () => {
  const { db, dispose } = await createTestDatabase('005_inventory_posting');
  try {
    await migrateDown(db);
    assert.equal(await db.get("SELECT id FROM schema_migrations WHERE id='005_inventory_posting'"), undefined);
    console.log('B1A3_MIGRATION 005 down empty=success');
    await seedDemo(db, 'test-only-password');
    await db.run(`INSERT INTO inbound_receipts(id,receipt_no,supplier_code,warehouse_code,created_by,created_at,status)
      VALUES('HISTORY','HISTORY','DEMO-SUPPLIER','DEMO-WH','owner',UTC_TIMESTAMP(3),'audited')`);
    await migrateUp(db, '005_inventory_posting');
    assert.deepEqual(
      await db.get("SELECT status,posting_state,confirmation_operation_id FROM inbound_receipts WHERE id='HISTORY'"),
      { status: 'audited', posting_state: 'legacy', confirmation_operation_id: null },
    );
    const before = await db.all('SELECT * FROM inbound_receipts');
    let refusal = '';
    try {
      await migrateDown(db);
    } catch (error) {
      refusal = String(error);
    }
    assert.match(refusal, /拒绝回退：inbound_receipts 含有数据/);
    assert.deepEqual(await db.all('SELECT * FROM inbound_receipts'), before);
    assert.equal(
      (await db.get("SELECT state FROM schema_migrations WHERE id='005_inventory_posting'"))?.state,
      'applied',
    );
    console.log(`B1A3_MIGRATION 005 up historical=success status_unchanged=true down_nonempty=${refusal}`);
  } finally {
    await dispose();
  }
});

test('005 非空调整操作禁止 down，库存/流水/审计完整保留', async () => {
  const { db, dispose } = await fixture('005_inventory_posting');
  try {
    await seedPosted005Adjustment(db);
    const before = await inventorySnapshot(db);
    for (const table of ['inventory_operations', 'stock_journal', 'operation_log', 'idempotent_commands'])
      assert(before[table].length > 0, `${table} must be populated before testing nonempty rollback`);
    await assert.rejects(migrateDown(db), /拒绝回退：inventory_operations 含有数据/);
    assert.deepEqual(await inventorySnapshot(db), before);
    console.log('B1A3_MIGRATION 005 down: 拒绝回退：inventory_operations 含有数据，禁止删除历史数据; unchanged=true');
  } finally {
    await dispose();
  }
});
