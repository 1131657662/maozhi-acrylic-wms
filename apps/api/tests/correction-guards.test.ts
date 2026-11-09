import { test } from 'node:test';
import { randomUUID } from 'node:crypto';
import assert from 'node:assert/strict';
import { correctionFixture, expectUnchanged } from './correction-fixture.ts';
import { createStocktake } from '../src/features/stocktake/create.ts';
import { actor } from './fixture.ts';
import { businessFingerprint, injectLifecycleFailure } from './lifecycle-fixture.ts';

test('B5a 负库存按包数/吨数独立409且全库不变', async () => {
  const c = await correctionFixture('outbound');
  try {
    for (const delta of [
      { packages: 100, weightGrams: 0 },
      { packages: 0, weightGrams: 9_000_000 },
    ]) {
      const result = await expectUnchanged(c, await c.input(delta), 409);
      assert.equal(result.code, 'INSUFFICIENT_STOCK');
      console.log('B5A_NEGATIVE', JSON.stringify({ delta, ...result }));
    }
  } finally {
    await c.dispose();
  }
});
test('B5a 历史导入单409且全库不变', async () => {
  const c = await correctionFixture();
  try {
    const input = await c.input();
    await c.db.run('UPDATE inbound_receipts SET source_id=? WHERE id=?', ['HISTORY-B5A', c.target.id]);
    const result = await expectUnchanged(c, input, 409);
    assert.equal(result.code, 'LEGACY_CORRECTION_FORBIDDEN');
    console.log('B5A_HISTORY', JSON.stringify(result));
  } finally {
    await c.dispose();
  }
});
test('B5a 盘点暂停409且全库不变', async () => {
  const c = await correctionFixture();
  try {
    const input = await c.input();
    await createStocktake(c.db, { warehouseCode: 'DEMO-WH' }, randomUUID(), actor);
    const result = await expectUnchanged(c, input, 409);
    assert.equal(result.code, 'WAREHOUSE_STOCKTAKE_PAUSED');
    console.log('B5A_WINDOW', JSON.stringify(result));
  } finally {
    await c.dispose();
  }
});
for (const self of [true, false])
  test(`B5a ${self ? '自引用' : '间接'}环409且全库不变`, async () => {
    const c = await correctionFixture();
    try {
      const first = await c.post(await c.input()).expect(200),
        second = await c.post(await c.input()).expect(200);
      const input = await c.input();
      // Deliberately corrupt only this disposable DB to exercise persisted-chain defense.
      await c.db.run('UPDATE document_corrections SET previous_correction_id=? WHERE id=?', [
        self ? first.body.data.id : second.body.data.id,
        first.body.data.id,
      ]);
      const result = await expectUnchanged(c, input, 409);
      assert.equal(result.code, 'CORRECTION_CYCLE');
      console.log('B5A_CYCLE', JSON.stringify({ self, ...result }));
    } finally {
      await c.dispose();
    }
  });
test('B5a 所有禁改字段在单头/行均422且全库不变', async () => {
  const c = await correctionFixture();
  try {
    const input = await c.input();
    for (const field of [
      'productCode',
      'warehouseCode',
      'supplierCode',
      'customerCode',
      'receiptNo',
      'orderNo',
      'businessDate',
      'business_date',
    ]) {
      const header = await expectUnchanged(c, { ...input, [field]: 'FORBIDDEN' }, 422);
      const line = await expectUnchanged(c, { ...input, lines: [{ ...input.lines[0], [field]: 'FORBIDDEN' }] }, 422);
      console.log('B5A_FORBIDDEN_FIELD', JSON.stringify({ field, header, line }));
    }
  } finally {
    await c.dispose();
  }
});
for (const table of ['stock_journal', 'operation_log', 'idempotent_commands'])
  test(`B5a ${table}失败原子回滚同键重试`, async () => {
    const c = await correctionFixture();
    try {
      const input = await c.input(),
        key = randomUUID(),
        before = await businessFingerprint(c.db);
      await injectLifecycleFailure(c.db, table, 'INSERT');
      await c.post(input, key).expect(500);
      assert.deepEqual(await businessFingerprint(c.db), before);
      await c.db.run('DROP TRIGGER b2a_fail');
      await c.post(input, key).expect(200);
      console.log(
        'B5A_ROLLBACK',
        JSON.stringify({ table, failedStatus: 500, databaseUnchanged: true, sameKeyRetry: 200 }),
      );
    } finally {
      await c.dispose();
    }
  });
