import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { dateFixture, dateInput } from './date-correction-fixture.ts';
import { actor } from './fixture.ts';
import { createStocktake } from '../src/features/stocktake/create.ts';
import { voidStocktake } from '../src/features/stocktake/void.ts';
import { businessFingerprint } from './lifecycle-fixture.ts';

for (const kind of ['inbound', 'outbound'] as const)
  test(`B6e-3 ${kind} 日期更正在同仓盘点409，其他仓/释放后正常，原成功幂等可重放`, async () => {
    const c = await dateFixture(kind);
    try {
      const journal = await c.db.all('SELECT * FROM stock_journal ORDER BY id');
      await c.db.run(
        "INSERT INTO master_warehouses(code,name,created_at,updated_at) VALUES('DATE-OTHER','其他盘点仓',UTC_TIMESTAMP(3),UTC_TIMESTAMP(3))",
      );
      await createStocktake(c.db, { warehouseCode: 'DATE-OTHER', productCodes: ['ACR-032'] }, randomUUID(), actor);
      const key = randomUUID();
      const input = dateInput();
      const saved = await c.send(input, key).expect(200);
      const take = await createStocktake(c.db, { warehouseCode: 'DEMO-WH' }, randomUUID(), actor);
      const before = await businessFingerprint(c.db);
      const blocked = await c.send(dateInput(input.afterDate, 1)).expect(409);
      assert.equal(blocked.body.code, 'WAREHOUSE_STOCKTAKE_PAUSED');
      assert.ok(blocked.body.message.includes(take.number));
      assert.deepEqual(await businessFingerprint(c.db), before);
      const replay = await c.send(input, key).expect(200);
      assert.deepEqual(replay.body.data, saved.body.data);
      await voidStocktake(c.db, {
        id: take.id,
        key: randomUUID(),
        actor,
        input: { expectedRevision: 0, reason: '结束测试盘点窗口' },
      });
      await c.send(dateInput(input.afterDate, 1)).expect(200);
      assert.equal((await c.history()).records.length, 2);
      assert.deepEqual(await c.db.all('SELECT * FROM stock_journal ORDER BY id'), journal);
    } finally {
      await c.dispose();
    }
  });
