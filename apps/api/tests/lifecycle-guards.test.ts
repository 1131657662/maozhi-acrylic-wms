import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { numberingFixture, newReceipt, newPlan, origin } from './numbering-fixture.ts';
import { actor, fact } from './fixture.ts';
import { prepared, commandFor, businessFingerprint } from './lifecycle-fixture.ts';
import { executeLifecycle } from '../src/features/document-lifecycle/execute.ts';
import { lifecyclePreview } from '../src/features/document-lifecycle/preview.ts';
import { createInbound } from '../src/features/inbound/create.ts';
import { confirmInbound } from '../src/features/inbound/confirm.ts';
import { createOutboundPlan } from '../src/features/outbound/plans.ts';
import { adjustStock } from '../src/features/stock/adjust.ts';
import { recordFact } from '../src/features/scan/service.ts';
import { decimalToGrams } from '../src/db/weight.ts';

test('B2a 后续入库/调整/出库及库存缺口阻断，拒绝时全库不变', async () => {
  for (const dependency of ['inbound', 'adjustment', 'outbound', 'balance-gap'] as const) {
    const { db, dispose } = await numberingFixture();
    try {
      const target = await prepared(db, 'inbound'),
        command = await commandFor(db, target);
      if (dependency === 'inbound') await prepared(db, 'inbound');
      if (dependency === 'outbound') await prepared(db, 'outbound');
      if (dependency === 'adjustment') {
        const stock = (await db.get('SELECT packages,weight_tonnes FROM stock'))!;
        await adjustStock(
          db,
          {
            warehouseCode: 'DEMO-WH',
            productCode: 'ACR-032',
            packagesDelta: 1,
            weightDeltaGrams: 100,
            expected: { packages: Number(stock.packages), weightGrams: decimalToGrams(stock.weight_tonnes) },
            reason: '隔离依赖验收',
          },
          randomUUID(),
          actor,
        );
      }
      if (dependency === 'balance-gap') await db.run('UPDATE stock SET packages=0,weight_tonnes=0');
      const before = await businessFingerprint(db),
        preview = await lifecyclePreview(db, target);
      assert.equal(preview.allowed, false);
      await assert.rejects(executeLifecycle(db, command), {
        code: dependency === 'balance-gap' ? 'STOCK_EVIDENCE_MISMATCH' : 'DOWNSTREAM_DEPENDENCY',
      });
      assert.deepEqual(await businessFingerprint(db), before);
      console.log(
        `B2A_DEPENDENCY ${dependency} blocked=true database_unchanged=true details=${JSON.stringify(preview.blockers)}`,
      );
    } finally {
      await dispose();
    }
  }
});
test('B2a 未入账可作废但已入账不可；原因/历史/通道保护；新号不复用', async () => {
  const { db, web, api, dispose } = await numberingFixture();
  try {
    const receipt = await createInbound(db, newReceipt(), randomUUID(), actor),
      target = { kind: 'inbound' as const, id: receipt.id };
    const command = await commandFor(db, target, 'void');
    const unchanged = await businessFingerprint(db);
    await web
      .post(`/api/v1/inbound/${receipt.id}/void`)
      .set('Origin', origin)
      .set('Idempotency-Key', command.key)
      .send({ ...command.input, reason: ' ' })
      .expect(422);
    assert.deepEqual(await businessFingerprint(db), unchanged);
    await assert.rejects(executeLifecycle(db, { ...command, action: 'reverse' }), { code: 'INVALID_TRANSITION' });
    for (const channel of ['pda', 'miniapp']) {
      const login = await api
        .post('/api/v1/auth/login')
        .send({ username: 'owner', password: 'test-only-password', channel });
      const before = await businessFingerprint(db);
      for (const action of ['reverse', 'void'])
        await api
          .post(`/api/v1/inbound/${receipt.id}/${action}`)
          .set('Authorization', `Bearer ${login.body.data.token}`)
          .set('Idempotency-Key', randomUUID())
          .send(command.input)
          .expect(403);
      assert.deepEqual(await businessFingerprint(db), before);
    }
    assert.equal((await executeLifecycle(db, command)).status, 'voided');
    assert.equal((await db.all('SELECT * FROM stock_journal')).length, 0);
    await assert.rejects(confirmInbound(db, receipt.id, randomUUID(), actor), { code: 'ALREADY_CONFIRMED' });
    const next = await createInbound(db, newReceipt(), randomUUID(), actor);
    assert.notEqual(next.receiptNo, receipt.receiptNo);
    await confirmInbound(db, next.id, randomUUID(), actor);
    await assert.rejects(executeLifecycle(db, await commandFor(db, { kind: 'inbound', id: next.id }, 'void')), {
      code: 'INVALID_TRANSITION',
    });
    await db.run("UPDATE inbound_receipts SET source_id='history-check' WHERE id=?", [next.id]);
    const historical = await businessFingerprint(db);
    await assert.rejects(executeLifecycle(db, await commandFor(db, { kind: 'inbound', id: next.id })), {
      code: 'LEGACY_READ_ONLY',
    });
    assert.deepEqual(await businessFingerprint(db), historical);
    console.log(
      'B2A_GUARDS empty_reason=422 pda=403 miniapp=403 posted_void=409 history=409 number_reused=false void_journal=0',
    );
  } finally {
    await dispose();
  }
});
test('B2a 现场事实/所有PDA读取路径阻断作废，Web读取不误标下发', async () => {
  const { db, web, api, dispose } = await numberingFixture();
  try {
    const login = await api
      .post('/api/v1/auth/login')
      .send({ username: 'owner', password: 'test-only-password', channel: 'pda' });
    for (const path of ['outbound', 'scan/plans'])
      for (const list of [false, true]) {
        const plan = await createOutboundPlan(db, newPlan(), randomUUID(), actor),
          target = { kind: 'outbound' as const, id: plan.id };
        await web.get(`/api/v1/outbound/${plan.id}`).expect(200);
        assert.equal((await lifecyclePreview(db, target)).allowed, true);
        await api
          .get(`/api/v1/${path}${list ? `?keyword=${plan.orderNo}` : `/${plan.id}`}`)
          .set('Authorization', `Bearer ${login.body.data.token}`)
          .expect(200);
        const before = await businessFingerprint(db);
        await assert.rejects(executeLifecycle(db, await commandFor(db, target, 'void')), { code: 'PDA_EXPOSURE' });
        assert.deepEqual(await businessFingerprint(db), before);
      }
    const plan = await createOutboundPlan(db, newPlan(), randomUUID(), actor);
    await recordFact(db, { planId: plan.id, fact: fact(), actor });
    await assert.rejects(executeLifecycle(db, await commandFor(db, { kind: 'outbound', id: plan.id }, 'void')), {
      code: 'SCAN_DEPENDENCY',
    });
    const untouched = await createOutboundPlan(db, newPlan(), randomUUID(), actor);
    assert.equal(
      (await executeLifecycle(db, await commandFor(db, { kind: 'outbound', id: untouched.id }, 'void'))).status,
      'voided',
    );
    console.log(
      'B2A_EXPOSURE four_pda_read_paths=blocked web_read=no_exposure scanned_plan=blocked untouched_plan=voided',
    );
  } finally {
    await dispose();
  }
});
