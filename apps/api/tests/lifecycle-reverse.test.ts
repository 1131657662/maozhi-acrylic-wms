import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { numberingFixture, origin } from './numbering-fixture.ts';
import { actor, fact } from './fixture.ts';
import { prepared, commandFor, businessFingerprint, netDelta } from './lifecycle-fixture.ts';
import { executeLifecycle } from '../src/features/document-lifecycle/execute.ts';
import { recordFact } from '../src/features/scan/service.ts';
import { getOrder } from '../src/features/outbound/repository.ts';
import { confirmInbound } from '../src/features/inbound/confirm.ts';
import { confirmScannedFixture as confirmOutbound } from './fixture.ts';
import { freezePlan } from '../src/features/scan/freeze.ts';

for (const kind of ['inbound', 'outbound'] as const) {
  test(`B2a ${kind} 20 HTTP并发只1笔补偿，净delta=0，原单终态不可重开`, async () => {
    const { db, web, dispose } = await numberingFixture();
    try {
      const target = await prepared(db, kind),
        command = await commandFor(db, target);
      const originalFacts = await db.all('SELECT * FROM scan_facts');
      const results = await Promise.all(
        Array.from({ length: 20 }, () =>
          web
            .post(`/api/v1/${kind}/${target.id}/reverse`)
            .set('Origin', origin)
            .set('Idempotency-Key', command.key)
            .send(command.input),
        ),
      );
      assert.ok(
        results.every((r) => r.status === 200),
        JSON.stringify(results.map((r) => r.body)),
      );
      assert.equal(new Set(results.map((r) => r.body.data.closure.compensationOperationId)).size, 1);
      assert.equal(
        Number(
          (await db.get("SELECT COUNT(*) AS n FROM inventory_operations WHERE operation_type LIKE '%.reverse'"))?.n,
        ),
        1,
      );
      assert.deepEqual(await db.get('SELECT packages,weight_tonnes FROM stock'), {
        packages: 6,
        weight_tonnes: '1.8000',
      });
      const net = await netDelta(db);
      assert.equal(Number(net[0]?.packages_net), 0);
      assert.equal(Number(net[0]?.tonnes_net), 0);
      const unchanged = await businessFingerprint(db);
      await assert.rejects(executeLifecycle(db, { ...command, key: randomUUID() }), { code: 'INVALID_TRANSITION' });
      await assert.rejects(executeLifecycle(db, { ...command, input: { ...command.input, reason: '另一正文' } }), {
        code: 'IDEMPOTENCY_CONFLICT',
      });
      if (kind === 'inbound')
        await assert.rejects(confirmInbound(db, target.id, randomUUID(), actor), { code: 'ALREADY_CONFIRMED' });
      else {
        const closed = await getOrder(db, target.id);
        await assert.rejects(confirmOutbound(db, { planId: target.id, key: randomUUID(), expected: closed, actor }), {
          code: 'PLAN_CLOSED',
        });
        await assert.rejects(freezePlan(db, { planId: target.id, key: randomUUID(), expected: closed, actor }), {
          code: 'PLAN_CLOSED',
        });
        await assert.rejects(recordFact(db, { planId: target.id, fact: fact({ barcode: 'DEMO-032-13' }), actor }), {
          code: 'PLAN_CLOSED',
        });
        const { planId, recordedBy, receivedAt, productCode, productName, ...oldFact } = closed.facts[0]!;
        assert.equal((await recordFact(db, { planId, fact: oldFact, actor })).status, 'cancelled');
      }
      assert.deepEqual(await businessFingerprint(db), unchanged);
      assert.deepEqual(await db.all('SELECT * FROM scan_facts'), originalFacts);
      console.log(
        `B2A_CONCURRENCY kind=${kind} requests=20 statuses=${results.map((r) => r.status).join(',')} compensation=1 stock=6/1.8000`,
      );
      console.log(`B2A_SQL_NET ${JSON.stringify(net)} facts_unchanged=true terminal_reopen=blocked`);
    } finally {
      await dispose();
    }
  });
}
