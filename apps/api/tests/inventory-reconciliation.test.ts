import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { fixture, actor } from './fixture.ts';
import { newReceipt } from './numbering-fixture.ts';
import { frozenOrder, adjustment } from './inventory-fixture.ts';
import { createInbound } from '../src/features/inbound/create.ts';
import { confirmInbound } from '../src/features/inbound/confirm.ts';
import { confirmScannedFixture as confirmOutbound } from './fixture.ts';
import { adjustStock } from '../src/features/stock/adjust.ts';

test('跨单调整：两张入库和一张出库共用库存格；SQL 验证整条流水与当前库存一致', async () => {
  const { db, dispose } = await fixture();
  try {
    const first = await createInbound(db, newReceipt(), randomUUID(), actor);
    const second = await createInbound(db, newReceipt(), randomUUID(), actor);
    await confirmInbound(db, first.id, randomUUID(), actor);
    const adjusted = await adjustStock(
      db,
      { ...adjustment(), expected: { packages: 7, weightGrams: 2102500 } },
      randomUUID(),
      actor,
    );
    assert.deepEqual(adjusted.after, { packages: 6, weightGrams: 1892200 });
    await confirmInbound(db, second.id, randomUUID(), actor);
    const plan = await frozenOrder(db);
    await confirmOutbound(db, { planId: plan.id, key: randomUUID(), expected: plan, actor });
    assert.equal((await db.get('SELECT packages FROM stock'))?.packages, 5);
    assert.equal((await db.get('SELECT weight_tonnes FROM stock'))?.weight_tonnes, '1.5947');
    assert.ok((await db.all('SELECT packages FROM inbound_lines')).every((row) => row.packages === 1));
    const sql = readFileSync(new URL('../../../scripts/sql/verify-inventory-posting.sql', import.meta.url), 'utf8');
    for (const statement of sql
      .replace(/^--.*$/gm, '')
      .split(';')
      .filter((part) => part.trim())) {
      const rows = await db.all(statement);
      assert.ok(rows.every((row) => ('balanced' in row ? Number(row.balanced) === 1 : Number(row.mismatches) === 0)));
      console.log(`B1A3_SQL ${JSON.stringify(rows)}`);
    }
  } finally {
    await dispose();
  }
});
