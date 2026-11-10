import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { numberingFixture, newReceipt, origin } from './numbering-fixture.ts';
import { actor } from './fixture.ts';
import { adjustment, inventorySnapshot, frozenOrder } from './inventory-fixture.ts';
import { createInbound } from '../src/features/inbound/create.ts';
import { confirmInbound } from '../src/features/inbound/confirm.ts';
import { confirmOutbound } from '../src/features/outbound/confirm.ts';
import { adjustStock } from '../src/features/stock/adjust.ts';
import { journalRows } from '../src/features/stock/journal.ts';

test('入库 20 并发同键确认只入账一次；异正文冲突；新键不重复确认', async () => {
  const { db, dispose } = await numberingFixture();
  try {
    const receipt = await createInbound(db, newReceipt(), randomUUID(), actor);
    const other = await createInbound(db, newReceipt(), randomUUID(), actor);
    const key = randomUUID();
    const results = await Promise.all(Array.from({ length: 20 }, () => confirmInbound(db, receipt.id, key, actor)));
    assert.equal(new Set(results.map((row) => row.confirmationOperationId)).size, 1);
    assert.equal((await db.get('SELECT packages FROM stock'))?.packages, 7);
    await assert.rejects(confirmInbound(db, other.id, key, actor), { code: 'IDEMPOTENCY_CONFLICT' });
    await assert.rejects(confirmInbound(db, receipt.id, randomUUID(), actor), { code: 'ALREADY_CONFIRMED' });
    assert.equal((await db.all('SELECT * FROM inventory_operations')).length, 1);
    console.log('B1A3_IDEMPOTENT inbound concurrent=20 operations=1 stock_delta_packages=1');
  } finally {
    await dispose();
  }
});
test('调整同键 20 并发只执行一次，前值过期及异正文拒绝且库不变', async () => {
  const { db, dispose } = await numberingFixture();
  try {
    const key = randomUUID();
    const rows = await Promise.all(Array.from({ length: 20 }, () => adjustStock(db, adjustment(), key, actor)));
    assert.equal(new Set(rows.map((row) => row.operationId)).size, 1);
    assert.deepEqual(rows[0]?.after, { packages: 5, weightGrams: 1589700 });
    const before = await inventorySnapshot(db);
    await assert.rejects(adjustStock(db, { ...adjustment(), reason: 'changed' }, key, actor), {
      code: 'IDEMPOTENCY_CONFLICT',
    });
    await assert.rejects(adjustStock(db, adjustment(), randomUUID(), actor), { code: 'STALE_STOCK' });
    assert.deepEqual(await inventorySnapshot(db), before);
    console.log('B1A3_IDEMPOTENT adjustment concurrent=20 operations=1 stale_stock_unchanged=true');
  } finally {
    await dispose();
  }
});
test('调整空原因 422、库存不足 409，全部表无变化', async () => {
  const { db, web, dispose } = await numberingFixture();
  try {
    for (const [body, status, code] of [
      [{ ...adjustment(), reason: '   ' }, 422, 'VALIDATION_ERROR'],
      [{ ...adjustment(), packagesDelta: -7 }, 409, 'INSUFFICIENT_STOCK'],
      [{ ...adjustment(), weightDeltaGrams: -1800100 }, 409, 'INSUFFICIENT_STOCK'],
    ] as const) {
      const before = await inventorySnapshot(db);
      const response = await web
        .post('/api/v1/stock/adjustments')
        .set('Origin', origin)
        .set('Idempotency-Key', randomUUID())
        .send(body)
        .expect(status);
      assert.equal(response.body.code, code);
      assert.deepEqual(await inventorySnapshot(db), before);
      console.log(`B1A3_REJECT status=${status} code=${code} database_unchanged=true`);
    }
  } finally {
    await dispose();
  }
});
test('出库同键并发扣减一次，每条新流水可追踪操作、前后值、原因及审计', async () => {
  const { db, dispose } = await numberingFixture();
  try {
    const frozen = await frozenOrder(db);
    const command = { planId: frozen.id, key: randomUUID(), expected: frozen, actor };
    const rows = await Promise.all(Array.from({ length: 10 }, () => confirmOutbound(db, command)));
    assert.ok(rows.every((row) => row.status === 'confirmed'));
    const [journal] = await journalRows(db, 20);
    assert.equal(journal?.operationType, 'outbound.confirm');
    assert.deepEqual(journal?.before, { packages: 6, weightGrams: 1800000 });
    assert.deepEqual(journal?.after, { packages: 4, weightGrams: 1200000 });
    assert.equal((await db.all('SELECT * FROM stock_journal')).length, 1);
    const audit = await db.get("SELECT after_json FROM operation_log WHERE action='outbound.confirm'");
    assert.equal(JSON.parse(String(audit?.after_json)).operationId, journal?.operationId);
    console.log(`B1A3_OUTBOUND ${JSON.stringify(journal)}`);
  } finally {
    await dispose();
  }
});
test('历史单据原状态保留，不根据 audited/submit 猜测回填或再次入账', async () => {
  const { db, dispose } = await numberingFixture();
  try {
    for (const status of ['audited', 'submit']) {
      const receipt = await createInbound(db, newReceipt(), randomUUID(), actor);
      await db.run("UPDATE inbound_receipts SET status=?,posting_state='legacy',source_id=? WHERE id=?", [
        status,
        `history-${receipt.id}`,
        receipt.id,
      ]);
      const before = await inventorySnapshot(db);
      await assert.rejects(confirmInbound(db, receipt.id, randomUUID(), actor), { code: 'LEGACY_RECEIPT' });
      assert.deepEqual(await inventorySnapshot(db), before);
    }
  } finally {
    await dispose();
  }
});
test('目录商品不能通过创建/确认/调整进入库存', async () => {
  const { db, dispose } = await numberingFixture();
  try {
    const receipt = await createInbound(db, newReceipt(), randomUUID(), actor);
    await db.run("UPDATE master_products SET source_kind='sku-spec',inventory_eligible=0 WHERE code='ACR-032'");
    const before = await inventorySnapshot(db);
    await assert.rejects(createInbound(db, newReceipt(), randomUUID(), actor), { code: 'PRODUCT_NOT_INVENTORY' });
    await assert.rejects(confirmInbound(db, receipt.id, randomUUID(), actor), { code: 'PRODUCT_NOT_INVENTORY' });
    await assert.rejects(adjustStock(db, adjustment(), randomUUID(), actor), { code: 'PRODUCT_NOT_INVENTORY' });
    assert.deepEqual(await inventorySnapshot(db), before);
  } finally {
    await dispose();
  }
});
