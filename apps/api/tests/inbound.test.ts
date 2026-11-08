import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { fixture, actor } from './fixture.ts';
import { createInbound } from '../src/features/inbound/create.ts';
import { confirmInbound } from '../src/features/inbound/confirm.ts';

const receipt = {
  receiptNo: 'IN-TEST-001',
  supplierCode: 'DEMO-SUPPLIER',
  warehouseCode: 'DEMO-WH',
  memo: '合成入库测试',
  lines: [{ productCode: 'ACR-032', packages: 3, weightGrams: 612300 }],
};
test('入库按独立包数和总重量增加库存，重试只记一次', async () => {
  const { db, dispose } = await fixture();
  try {
    const key = randomUUID();
    const first = await createInbound(db, receipt, key, actor);
    assert.deepEqual(await createInbound(db, receipt, key, actor), first);
    assert.equal(first.packages, 3);
    assert.equal(first.weightGrams, 612300);
    assert.equal(first.postingState, 'pending');
    assert.equal((await db.get('SELECT packages FROM stock'))?.packages, 6);
    const confirmKey = randomUUID();
    const confirmed = await confirmInbound(db, first.id, confirmKey, actor);
    assert.equal(confirmed.status, 'confirmed');
    assert.deepEqual(await confirmInbound(db, first.id, confirmKey, actor), confirmed);
    assert.equal((await db.get('SELECT packages FROM stock WHERE product_code=?', ['ACR-032']))?.packages, 9);
    assert.equal(
      (await db.get('SELECT weight_tonnes FROM stock WHERE product_code=?', ['ACR-032']))?.weight_tonnes,
      '2.4123',
    );
    assert.equal((await db.all('SELECT * FROM stock_journal WHERE inbound_receipt_id=?', [first.id])).length, 1);
    assert.equal((await db.all("SELECT * FROM operation_log WHERE action='inbound.confirm'")).length, 1);
    assert.equal((await db.all('SELECT * FROM scan_facts')).length, 0);
  } finally {
    await dispose();
  }
});
test('库存 decimal 上限溢出时确认回滚，保留待确认入库单', async () => {
  const { db, dispose } = await fixture();
  try {
    const pending = await createInbound(
      db,
      {
        ...receipt,
        receiptNo: 'IN-OVERFLOW',
        lines: [{ productCode: 'ACR-032', packages: 1, weightGrams: 99_999_999_999_900 }],
      },
      randomUUID(),
      actor,
    );
    await assert.rejects(confirmInbound(db, pending.id, randomUUID(), actor), { code: 'STOCK_OVERFLOW' });
    assert.equal((await db.get('SELECT status FROM inbound_receipts WHERE id=?', [pending.id]))?.status, 'pending');
    assert.equal((await db.get('SELECT packages FROM stock WHERE product_code=?', ['ACR-032']))?.packages, 6);
    assert.equal((await db.all('SELECT * FROM stock_journal')).length, 0);
    assert.equal((await db.all("SELECT * FROM operation_log WHERE action='inbound.confirm'")).length, 0);
  } finally {
    await dispose();
  }
});
