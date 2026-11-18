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
import type { Database } from '../src/db/mysql.ts';

async function reconciliation(db: Database) {
  const sql = readFileSync(new URL('../../../scripts/sql/verify-inventory-posting.sql', import.meta.url), 'utf8');
  const statements = sql
    .replace(/^--.*$/gm, '')
    .split(';')
    .filter((part) => part.trim());
  assert.equal(statements.length, 3);
  return {
    evidence: await db.all(statements[0]!),
    balances: await db.all(statements[1]!),
    missing: await db.all(statements[2]!),
  };
}

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
    const { evidence, balances, missing } = await reconciliation(db);
    assert.equal(Number(evidence[0]?.mismatches), 0);
    assert.equal(balances.length, 1);
    assert.equal(Number(balances[0]?.balanced), 1);
    assert.equal(missing.length, 0);
  } finally {
    await dispose();
  }
});

test('F05 新流水只有软删库存格时，对账指明缺格仓品且不平衡', async () => {
  const { db, dispose } = await fixture();
  try {
    const receipt = await createInbound(db, newReceipt(), randomUUID(), actor);
    await confirmInbound(db, receipt.id, randomUUID(), actor);
    await db.run('UPDATE stock SET source_del_flag=1 WHERE warehouse_code=? AND product_code=?', [
      'DEMO-WH',
      'ACR-032',
    ]);
    const { balances, missing } = await reconciliation(db);
    assert.equal(balances.length, 1);
    assert.equal(balances[0]?.current_packages, null);
    assert.equal(Number(balances[0]?.balanced), 0);
    assert.deepEqual(
      missing.map((row) => [row.warehouse_code, row.product_code, Number(row.posted_rows)]),
      [['DEMO-WH', 'ACR-032', 1]],
    );
  } finally {
    await dispose();
  }
});
