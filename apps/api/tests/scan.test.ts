import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { fixture, fact, actor } from './fixture.ts';
import { recordFact } from '../src/features/scan/service.ts';
import { freezePlan } from '../src/features/scan/freeze.ts';
import { getOrder } from '../src/features/outbound/repository.ts';

test('不同逐包实重独立累计，冻结不扣库存', async () => {
  const { db, dispose } = await fixture();
  try {
    const before = await db.all('SELECT * FROM stock');
    await recordFact(db, { planId: 'DEMO-001', fact: fact(), actor });
    const plan = await recordFact(db, {
      planId: 'DEMO-001',
      fact: fact({ barcode: 'DEMO-032-12', weightGrams: 297500 }),
      actor,
    });
    const frozen = await freezePlan(db, { planId: plan.id, key: randomUUID(), expected: plan, actor });
    assert.equal(frozen.actualWeightGrams, 600000);
    assert.equal(frozen.status, 'frozen');
    assert.deepEqual(await db.all('SELECT * FROM stock'), before);
    assert.equal((await db.all('SELECT * FROM stock_journal')).length, 0);
  } finally {
    await dispose();
  }
});
test('同一事实重试不新增记录，正文冲突拒绝', async () => {
  const { db, dispose } = await fixture();
  try {
    const command = { planId: 'DEMO-001', fact: fact(), actor };
    await recordFact(db, command);
    await recordFact(db, command);
    assert.equal((await getOrder(db, command.planId)).actualPackages, 1);
    await assert.rejects(recordFact(db, { ...command, fact: { ...command.fact, deviceId: 'changed' } }), {
      code: 'IDEMPOTENCY_CONFLICT',
    });
  } finally {
    await dispose();
  }
});
test('同条码不同事实或跨计划重复被拦截', async () => {
  const { db, dispose } = await fixture();
  try {
    await recordFact(db, { planId: 'DEMO-001', fact: fact(), actor });
    await assert.rejects(recordFact(db, { planId: 'DEMO-002', fact: fact(), actor }), { code: 'DUPLICATE_BARCODE' });
  } finally {
    await dispose();
  }
});
test('目录实重不符与未知码不得入队服务端', async () => {
  const { db, dispose } = await fixture();
  try {
    await assert.rejects(recordFact(db, { planId: 'DEMO-001', fact: fact({ weightGrams: 300000 }), actor }), {
      code: 'WEIGHT_MISMATCH',
    });
    await assert.rejects(recordFact(db, { planId: 'DEMO-001', fact: fact({ barcode: 'UNKNOWN' }), actor }), {
      code: 'UNKNOWN_BARCODE',
    });
    assert.equal((await getOrder(db, 'DEMO-001')).actualPackages, 0);
  } finally {
    await dispose();
  }
});
test('短装、旧修订号均禁止冻结', async () => {
  const { db, dispose } = await fixture();
  try {
    const before = await getOrder(db, 'DEMO-001');
    const after = await recordFact(db, { planId: 'DEMO-001', fact: fact(), actor });
    await assert.rejects(freezePlan(db, { planId: before.id, key: randomUUID(), expected: before, actor }), {
      code: 'STALE_PLAN',
    });
    await assert.rejects(freezePlan(db, { planId: after.id, key: randomUUID(), expected: after, actor }), {
      code: 'PLAN_DIFFERENCE',
    });
  } finally {
    await dispose();
  }
});
