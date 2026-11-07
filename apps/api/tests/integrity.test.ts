import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { factInputSchema } from '@wms/contracts';
import { fixture, fact, actor } from './fixture.ts';
import { getOrder } from '../src/features/outbound/repository.ts';
import { recordFact } from '../src/features/scan/service.ts';
import { freezePlan } from '../src/features/scan/freeze.ts';
import { confirmOutbound } from '../src/features/outbound/confirm.ts';

test('零重、负重、非100克精度与缺少来源被边界拒绝', () => {
  for (const grams of [0, -100, 302501, 0.5, NaN])
    assert.equal(factInputSchema.safeParse(fact({ weightGrams: grams })).success, false);
  const { weightSource, ...withoutSource } = fact();
  void weightSource;
  assert.equal(factInputSchema.safeParse(withoutSource).success, false);
});
test('冻结请求重试不新增版本，摘要不符拒绝', async () => {
  const { db, dispose } = await fixture();
  try {
    await recordFact(db, { planId: 'DEMO-001', fact: fact(), actor });
    const plan = await recordFact(db, {
      planId: 'DEMO-001',
      fact: fact({ barcode: 'DEMO-032-12', weightGrams: 297500 }),
      actor,
    });
    const command = { planId: plan.id, key: randomUUID(), expected: plan, actor };
    await assert.rejects(freezePlan(db, { ...command, expected: { ...plan, digest: '0'.repeat(64) } }), {
      code: 'STALE_PLAN',
    });
    const first = await freezePlan(db, command);
    assert.deepEqual(await freezePlan(db, command), first);
    assert.equal((await getOrder(db, plan.id)).revision, 3);
  } finally {
    await dispose();
  }
});
test('后续商品库存不足回滚此前商品的扣减与流水', async () => {
  const { db, dispose } = await fixture();
  try {
    await db.run('INSERT INTO master_products(code,name,active,created_at,updated_at) VALUES(?,?,?,?,?)',
      ['ACR-EXTRA','合成第二商品',1,'2026-11-07 00:00:00.000','2026-11-07 00:00:00.000']);
    await db.run(`INSERT INTO outbound_lines
      (id,order_id,product_code,product_name,planned_packages,planned_weight_tonnes)
      VALUES(?,?,?,?,?,?)`, ['extra', 'DEMO-001', 'ACR-EXTRA', '合成第二商品', 1, '0.1000']);
    await db.run('INSERT INTO scan_catalog(barcode,product_code,weight_tonnes,catalog_version) VALUES(?,?,?,?)',
      ['DEMO-EXTRA', 'ACR-EXTRA', '0.1000', 1]);
    await recordFact(db, { planId: 'DEMO-001', fact: fact(), actor });
    await recordFact(db, { planId: 'DEMO-001', fact: fact({ barcode: 'DEMO-032-12', weightGrams: 297500 }), actor });
    const plan = await recordFact(db, {
      planId: 'DEMO-001',
      fact: fact({ barcode: 'DEMO-EXTRA', weightGrams: 100000 }),
      actor,
    });
    const frozen = await freezePlan(db, { planId: plan.id, key: randomUUID(), expected: plan, actor });
    await assert.rejects(confirmOutbound(db, { planId: plan.id, key: randomUUID(), expected: frozen, actor }), {
      code: 'INSUFFICIENT_STOCK',
    });
    assert.equal((await db.get('SELECT packages FROM stock'))?.packages, 6);
    assert.equal((await db.all('SELECT * FROM stock_journal')).length, 0);
    assert.equal((await getOrder(db, plan.id)).status, 'frozen');
  } finally {
    await dispose();
  }
});
