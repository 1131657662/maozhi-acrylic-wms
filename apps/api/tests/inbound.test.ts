import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { fixture, actor } from './fixture.ts';
import { createInbound } from '../src/features/inbound/create.ts';

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
    assert.equal((await db.get('SELECT packages FROM stock WHERE product_code=?', ['ACR-032']))?.packages, 9);
    assert.equal((await db.get('SELECT weight_tonnes FROM stock WHERE product_code=?', ['ACR-032']))?.weight_tonnes, '2.4123');
    assert.equal((await db.all('SELECT * FROM stock_journal WHERE inbound_receipt_id=?', [first.id])).length, 1);
    assert.equal((await db.all("SELECT * FROM operation_log WHERE action='inbound.confirm'")).length, 1);
    assert.equal((await db.all('SELECT * FROM scan_facts')).length, 0);
  } finally {
    await dispose();
  }
});
test('库存 decimal 上限溢出时入库单、库存、流水与日志一起回滚', async () => {
  const { db, dispose } = await fixture();
  try {
    await assert.rejects(createInbound(db, { ...receipt, receiptNo: 'IN-OVERFLOW',
      lines: [{ productCode: 'ACR-032', packages: 1, weightGrams: 99_999_999_999_900 }] }, randomUUID(), actor));
    assert.equal(Number((await db.get('SELECT COUNT(*) AS n FROM inbound_receipts'))?.n), 0);
    assert.equal((await db.get('SELECT packages FROM stock WHERE product_code=?', ['ACR-032']))?.packages, 6);
    assert.equal((await db.all('SELECT * FROM stock_journal')).length, 0);
    assert.equal((await db.all("SELECT * FROM operation_log WHERE action='inbound.confirm'")).length, 0);
  } finally {
    await dispose();
  }
});
