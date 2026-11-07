import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { fixture, fact, actor } from './fixture.ts';
import { recordFact } from '../src/features/scan/service.ts';
import { freezePlan } from '../src/features/scan/freeze.ts';
import { confirmOutbound } from '../src/features/outbound/confirm.ts';
import { getOrder } from '../src/features/outbound/repository.ts';
import type { Database } from '../src/db/mysql.ts';

async function frozenFixture(db: Database) {
  await recordFact(db, { planId: 'DEMO-001', fact: fact(), actor });
  const plan = await recordFact(db, {
    planId: 'DEMO-001',
    fact: fact({ barcode: 'DEMO-032-12', weightGrams: 297500 }),
    actor,
  });
  return freezePlan(db, { planId: plan.id, key: randomUUID(), expected: plan, actor });
}
test('确认按实重扣减一次，重复确认返回原结果', async () => {
  const { db, dispose } = await fixture();
  try {
    const frozen = await frozenFixture(db);
    const command = { planId: frozen.id, key: randomUUID(), expected: frozen, actor };
    const first = await confirmOutbound(db, command);
    const replay = await confirmOutbound(db, command);
    assert.deepEqual(replay, first);
    assert.equal((await db.get('SELECT packages FROM stock'))?.packages, 4);
    assert.equal((await db.get('SELECT weight_tonnes FROM stock'))?.weight_tonnes, '1.2000');
    assert.equal((await db.all('SELECT * FROM stock_journal')).length, 1);
    assert.equal((await db.all("SELECT * FROM operation_log WHERE action='outbound.confirm'")).length, 1);
    await assert.rejects(confirmOutbound(db, { ...command, key: randomUUID() }), { code: 'STALE_PLAN' });
  } finally {
    await dispose();
  }
});
test('库存不足使确认、流水和状态一起回滚', async () => {
  const { db, dispose } = await fixture();
  try {
    const frozen = await frozenFixture(db);
    await db.run('UPDATE stock SET weight_tonnes=?', ['0.1000']);
    await assert.rejects(confirmOutbound(db, { planId: frozen.id, key: randomUUID(), expected: frozen, actor }), {
      code: 'INSUFFICIENT_STOCK',
    });
    assert.equal((await getOrder(db, frozen.id)).status, 'frozen');
    assert.equal((await db.all('SELECT * FROM stock_journal')).length, 0);
    assert.equal((await db.get('SELECT packages FROM stock'))?.packages, 6);
  } finally {
    await dispose();
  }
});
test('冻结后禁止新事实但保留已接收事实的重试能力', async () => {
  const { db, dispose } = await fixture();
  try {
    const original = fact();
    await recordFact(db, { planId: 'DEMO-001', fact: original, actor });
    const plan = await recordFact(db, {
      planId: 'DEMO-001',
      fact: fact({ barcode: 'DEMO-032-12', weightGrams: 297500 }),
      actor,
    });
    await freezePlan(db, { planId: plan.id, key: randomUUID(), expected: plan, actor });
    assert.equal((await recordFact(db, { planId: plan.id, fact: original, actor })).actualPackages, 2);
    await assert.rejects(
      recordFact(db, { planId: plan.id, fact: fact({ barcode: 'DEMO-032-21', weightGrams: 280000 }), actor }),
      { code: 'PLAN_CLOSED' },
    );
  } finally {
    await dispose();
  }
});
