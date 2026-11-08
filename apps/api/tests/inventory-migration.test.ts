import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createTestDatabase } from '../../../scripts/mysql/test-database.ts';
import { migrateDown, migrateUp } from '../src/db/migrate.ts';
import { seedDemo } from '../src/db/seed-test.ts';
import { fixture, actor } from './fixture.ts';
import { adjustment, inventorySnapshot } from './inventory-fixture.ts';
import { adjustStock } from '../src/features/stock/adjust.ts';
import { randomUUID } from 'node:crypto';

test('005 空表 down/up，历史非空无改状态地升级，非空 down 拒绝', async () => {
  const { db, dispose } = await createTestDatabase();
  try {
    await migrateDown(db);
    assert.equal(await db.get("SELECT id FROM schema_migrations WHERE id='005_inventory_posting'"), undefined);
    console.log('B1A3_MIGRATION 005 down empty=success');
    await seedDemo(db, 'test-only-password');
    await db.run(`INSERT INTO inbound_receipts(id,receipt_no,supplier_code,warehouse_code,created_by,created_at,status)
      VALUES('HISTORY','HISTORY','DEMO-SUPPLIER','DEMO-WH','owner',UTC_TIMESTAMP(3),'audited')`);
    await migrateUp(db);
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
  const { db, dispose } = await fixture();
  try {
    await adjustStock(db, adjustment(), randomUUID(), actor);
    const before = await inventorySnapshot(db);
    await assert.rejects(migrateDown(db), /拒绝回退：inventory_operations 含有数据/);
    assert.deepEqual(await inventorySnapshot(db), before);
    console.log('B1A3_MIGRATION 005 down: 拒绝回退：inventory_operations 含有数据，禁止删除历史数据; unchanged=true');
  } finally {
    await dispose();
  }
});
