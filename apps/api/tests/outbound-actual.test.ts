import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { actor, fact, fixture } from './fixture.ts';
import { recordFact } from '../src/features/scan/service.ts';
import { getOrder } from '../src/features/outbound/repository.ts';
import { confirmOutbound } from '../src/features/outbound/confirm.ts';
import { addV1Fixture } from './catalog-fixture.ts';
import { createOutboundPlan } from '../src/features/outbound/plans.ts';
import { lifecyclePreview } from '../src/features/document-lifecycle/preview.ts';

const quantity = (id: string, packages = 1, grams = 200000) => ({
  lineId: id,
  actualPackages: packages,
  actualWeightGrams: grams,
});
test('B4d manual quantities determine stock and shipment; late scans cannot change posted quantities', async () => {
  const c = await fixture();
  try {
    const before = await recordFact(c.db, { planId: 'DEMO-001', fact: fact(), actor });
    const command = {
      planId: before.id,
      expected: before,
      lines: [quantity(before.lines[0]!.id)],
      key: randomUUID(),
      actor,
    };
    const confirmed = await confirmOutbound(c.db, command);
    const stock = await c.db.get('SELECT packages,weight_tonnes FROM stock');
    assert.deepEqual(stock, { packages: 5, weight_tonnes: '1.6000' });
    assert.equal(confirmed.actualWeightGrams, 200000);
    assert.equal(confirmed.scanWeightGrams, 302500);
    const snapshot = await c.db.all('SELECT scan_packages,scan_weight_grams FROM outbound_lines ORDER BY id');
    const late = await recordFact(c.db, {
      planId: before.id,
      fact: fact({ barcode: 'DEMO-032-12', weightGrams: 297500 }),
      actor,
    });
    assert.equal(late.facts.length, 2);
    assert.equal(late.actualWeightGrams, 200000);
    assert.deepEqual(
      await c.db.all('SELECT scan_packages,scan_weight_grams FROM outbound_lines ORDER BY id'),
      snapshot,
    );
    assert.deepEqual(await c.db.get('SELECT packages,weight_tonnes FROM stock'), stock);
    assert.deepEqual(await confirmOutbound(c.db, command), confirmed);
    assert.equal(Number((await c.db.get('SELECT COUNT(*) AS n FROM outbound_shipments'))?.n), 1);
    console.log(
      'B4D_MANUAL scan=1/302500g actual=1/200000g stock=5/1600000g shipment=1 late_scans=2 unchanged=true replay=1',
    );
  } finally {
    await c.dispose();
  }
});
test('B4d no scans required; 10 concurrent retries create one shipment and success event', async () => {
  const c = await fixture();
  try {
    const before = await getOrder(c.db, 'DEMO-001');
    const command = {
      planId: before.id,
      expected: before,
      lines: [quantity(before.lines[0]!.id)],
      key: randomUUID(),
      actor,
    };
    const results = await Promise.all(Array.from({ length: 10 }, () => confirmOutbound(c.db, command)));
    results.forEach((result) => assert.deepEqual(result, results[0]));
    for (const table of ['outbound_shipments', 'stock_journal'])
      assert.equal(Number((await c.db.get(`SELECT COUNT(*) AS n FROM ${table}`))?.n), 1);
    assert.equal(
      Number((await c.db.get("SELECT COUNT(*) AS n FROM operation_log WHERE action='outbound.confirm'"))?.n),
      1,
    );
    await assert.rejects(confirmOutbound(c.db, { ...command, lines: [quantity(before.lines[0]!.id, 2)] }), {
      code: 'IDEMPOTENCY_CONFLICT',
    });
    console.log('B4D_CONCURRENCY requests=10 shipments=1 journals=1 success_events=1 no_scan=true changed_body=409');
  } finally {
    await c.dispose();
  }
});
test('B4d empty actual returns 422 with row path, all zero rejected, foreign and duplicate rows rejected', async () => {
  const c = await fixture();
  try {
    const web = request.agent(c.app);
    await web
      .post('/api/v1/auth/login')
      .send({ username: 'owner', password: 'test-only-password', channel: 'web' })
      .expect(200);
    const before = await getOrder(c.db, 'DEMO-001');
    const send = (lines: unknown) =>
      web
        .post(`/api/v1/outbound/${before.id}/confirm`)
        .set('Origin', 'http://127.0.0.1:5173')
        .set('Idempotency-Key', randomUUID())
        .send({ revision: before.revision, digest: before.digest, lines });
    const invalid = await send([{ lineId: before.lines[0]!.id, actualPackages: 1 }]).expect(422);
    assert.deepEqual(invalid.body.data.fields[0].path, ['lines', 0, 'actualWeightGrams']);
    await send([quantity(before.lines[0]!.id, 0, 0)]).expect(422);
    await send([quantity('wrong-line')]).expect(422);
    await send([quantity(before.lines[0]!.id), quantity(before.lines[0]!.id)]).expect(422);
    assert.equal(Number((await c.db.get('SELECT COUNT(*) AS n FROM outbound_shipments'))?.n), 0);
    console.log(
      `B4D_VALIDATION status=${invalid.status} field=${JSON.stringify(invalid.body.data.fields[0].path)} shipments=0`,
    );
  } finally {
    await c.dispose();
  }
});
test('B4d same product keeps line order; allocation 50 into 40/30 is 40/10; zero line allowed', async () => {
  const c = await fixture();
  try {
    const plan = await createOutboundPlan(
      c.db,
      {
        customerCode: 'DEMO-CUST-1',
        warehouseCode: 'DEMO-WH',
        vehicleNo: 'B4D',
        lines: [
          { productCode: 'ACR-032', plannedPackages: 40, plannedWeightGrams: 12000000 },
          { productCode: 'ACR-032', plannedPackages: 30, plannedWeightGrams: 9000000 },
        ],
      },
      randomUUID(),
      actor,
    );
    assert.deepEqual(
      plan.lines.map((l) => l.plannedPackages),
      [40, 30],
    );
    for (let index = 0; index < 50; index++) {
      const barcode = `MULTI-${index}`;
      await addV1Fixture(c.db, { barcode, product: 'ACR-032', tonnes: '0.3025' });
      await recordFact(c.db, {
        planId: plan.id,
        fact: fact({ barcode }),
        actor,
        context: { outboundLineId: plan.lines[0]!.id, sourceSpec: '合成规格', resolvedAt: null },
      });
    }
    const web = request.agent(c.app);
    await web
      .post('/api/v1/auth/login')
      .send({ username: 'owner', password: 'test-only-password', channel: 'web' })
      .expect(200);
    const prefill = await web.get(`/api/v1/outbound/${plan.id}/prefill`).expect(200);
    assert.deepEqual(
      prefill.body.data.lines.map(
        ({ scanPackages, scanWeightGrams }: { scanPackages: number; scanWeightGrams: number }) => ({
          scanPackages,
          scanWeightGrams,
        }),
      ),
      [
        { scanPackages: 40, scanWeightGrams: 12100000 },
        { scanPackages: 10, scanWeightGrams: 3025000 },
      ],
    );
    const current = await getOrder(c.db, plan.id);
    const result = await confirmOutbound(c.db, {
      planId: plan.id,
      expected: current,
      lines: [quantity(plan.lines[0]!.id), quantity(plan.lines[1]!.id, 0, 0)],
      key: randomUUID(),
      actor,
    });
    assert.deepEqual(
      result.lines.map((l) => l.actualPackages),
      [1, 0],
    );
    const preview = await lifecyclePreview(c.db, { kind: 'outbound', id: plan.id });
    assert.equal(preview.allowed, true);
    console.log(
      'B4D_ALLOCATION scan=50 plan=40/30 prefill=40/10 grams=12100000/3025000 posted=1/0 journal_rows=1 reversal_allowed=true',
    );
  } finally {
    await c.dispose();
  }
});
