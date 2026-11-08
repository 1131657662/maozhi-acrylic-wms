import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { fixture, actor, fact } from './fixture.ts';
import { createOutboundPlan, editOutboundPlan } from '../src/features/outbound/plans.ts';
import { recordFact } from '../src/features/scan/service.ts';

const plan = {
  orderNo: 'OUT-TEST-001',
  customerCode: 'DEMO-CUST-1',
  warehouseCode: 'DEMO-WH',
  vehicleNo: '测试车辆',
  lines: [{ productCode: 'ACR-032', plannedPackages: 1, plannedWeightGrams: 302500 }],
};
test('待扫码计划可修改且不预占库存；重复创建请求幂等', async () => {
  const { db, dispose } = await fixture();
  try {
    const key = randomUUID();
    const created = await createOutboundPlan(db, plan, key, actor);
    assert.deepEqual(await createOutboundPlan(db, plan, key, actor), created);
    const edited = await editOutboundPlan(
      db,
      created.id,
      {
        revision: created.revision,
        digest: created.digest,
        plan: { vehicleNo: '已更新车辆', memo: '仅改表头' },
      },
      randomUUID(),
      actor,
    );
    assert.equal(edited.vehicleNo, '已更新车辆');
    assert.equal(edited.revision, created.revision + 1);
    assert.deepEqual(edited.lines, created.lines);
    assert.equal(edited.memo, '仅改表头');
    assert.equal((await db.get('SELECT packages FROM stock WHERE product_code=?', ['ACR-032']))?.packages, 6);
  } finally {
    await dispose();
  }
});
test('计划有扫码事实后仍可修改车号备注，但明细不可编辑', async () => {
  const { db, dispose } = await fixture();
  try {
    const created = await createOutboundPlan(db, plan, randomUUID(), actor);
    const withFact = await recordFact(db, { planId: created.id, fact: fact(), actor });
    const edited = await editOutboundPlan(
      db,
      created.id,
      {
        revision: withFact.revision,
        digest: withFact.digest,
        plan: { vehicleNo: '已扫后修改' },
      },
      randomUUID(),
      actor,
    );
    assert.deepEqual(edited.facts, withFact.facts);
    assert.deepEqual(edited.lines, withFact.lines);
    await assert.rejects(
      editOutboundPlan(
        db,
        created.id,
        {
          revision: edited.revision,
          digest: edited.digest,
          plan: { ...plan, lines: [] },
        },
        randomUUID(),
        actor,
      ),
      { code: 'PLAN_LINES_IMMUTABLE' },
    );
    assert.equal((await db.all('SELECT * FROM scan_facts WHERE plan_id=?', [created.id])).length, 1);
  } finally {
    await dispose();
  }
});
