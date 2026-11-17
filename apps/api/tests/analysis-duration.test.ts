import test from 'node:test';
import assert from 'node:assert/strict';
import { shanghaiToday } from '@wms/contracts';
import { numberingFixture } from './numbering-fixture.ts';
import { prepared, commandFor } from './lifecycle-fixture.ts';
import { analysis } from '../src/features/analysis/cache.ts';
import { createInbound } from '../src/features/inbound/create.ts';
import { newReceipt, newPlan } from './numbering-fixture.ts';
import { createOutboundPlan } from '../src/features/outbound/plans.ts';
import { executeLifecycle } from '../src/features/document-lifecycle/execute.ts';
import { shipmentFixture, version } from './multi-shipment-fixture.ts';
import { actor } from './fixture.ts';
import { randomUUID } from 'node:crypto';

test('analysis confirmation durations use operation and final shipment evidence, not scan time', async () => {
  const c = await numberingFixture();
  try {
    const inbound = await prepared(c.db, 'inbound'),
      outbound = await prepared(c.db, 'outbound');
    await c.db.run(
      `UPDATE inbound_receipts r JOIN inventory_operations op ON op.id=r.confirmation_operation_id
      SET r.created_at=DATE_SUB(op.created_at,INTERVAL 2 HOUR) WHERE r.id=?`,
      [inbound.id],
    );
    await c.db.run(
      `UPDATE outbound_orders o JOIN
      (SELECT order_id,MAX(shipped_at) AS at FROM outbound_shipments GROUP BY order_id) f ON f.order_id=o.id
      SET o.created_at=DATE_SUB(f.at,INTERVAL 5 HOUR),o.scan_closed_at=DATE_SUB(f.at,INTERVAL 1 HOUR) WHERE o.id=?`,
      [outbound.id],
    );
    const pending = await createInbound(c.db, newReceipt(), randomUUID(), actor);
    await c.db.run(
      "UPDATE inbound_receipts SET created_at='2025-01-01 00:00:00',receipt_no='待确认合成单' WHERE id=?",
      [pending.id],
    );
    const query = { fromDay: shanghaiToday(), toDay: shanghaiToday(), basis: 'posted' as const },
      data = await analysis(c.db, query);
    assert.equal(data.duration.data!.inboundAverageHours, 2);
    assert.equal(data.duration.data!.outboundAverageHours, 5);
    assert.equal(data.duration.data!.inboundCompleted, 1);
    assert.equal(data.duration.data!.outboundCompleted, 1);
    assert.equal(data.duration.data!.longestPending!.number, '待确认合成单');
    assert.ok(data.duration.data!.longestPending!.elapsedHours > 0);
    await c.db.run('UPDATE inbound_receipts SET confirmation_operation_id=NULL WHERE id=?', [inbound.id]);
    const missing = await analysis(c.db, query);
    assert.equal(missing.duration.data!.inboundAverageHours, null);
    assert.equal(missing.duration.data!.outboundAverageHours, 5);
    assert.equal(missing.duration.verification, 'unverifiable');
    assert.ok(missing.duration.reason);
  } finally {
    await c.dispose();
  }
});

test('analysis duration excludes reversed and voided documents with counts and reasons', async () => {
  const c = await numberingFixture();
  try {
    const query = { fromDay: shanghaiToday(), toDay: shanghaiToday(), basis: 'posted' as const };
    for (const kind of ['inbound', 'outbound'] as const) {
      const target = await prepared(c.db, kind);
      // This case checks exclusion counts; establish chronology independently of the host/database clocks.
      const table = kind === 'inbound' ? 'inbound_receipts' : 'outbound_orders';
      await c.db.run(`UPDATE ${table} SET created_at='2025-01-01 00:00:00' WHERE id=?`, [target.id]);
      await executeLifecycle(c.db, await commandFor(c.db, target));
    }
    const voidInbound = await createInbound(c.db, newReceipt(), randomUUID(), actor),
      voidOutbound = await createOutboundPlan(c.db, newPlan(), randomUUID(), actor);
    for (const target of [
      { kind: 'inbound' as const, id: voidInbound.id },
      { kind: 'outbound' as const, id: voidOutbound.id },
    ]) {
      const table = target.kind === 'inbound' ? 'inbound_receipts' : 'outbound_orders';
      await c.db.run(`UPDATE ${table} SET created_at='2025-01-01 00:00:00' WHERE id=?`, [target.id]);
      await executeLifecycle(c.db, await commandFor(c.db, target, 'void'));
    }
    const result = (await analysis(c.db, query)).duration;
    assert.equal(result.data!.inboundCompleted, 0);
    assert.equal(result.data!.outboundCompleted, 0);
    assert.equal(result.data!.inboundAverageHours, null);
    assert.equal(result.data!.outboundAverageHours, null);
    assert.deepEqual(
      result.data!.exclusions.map((item) => item.count),
      [1, 1, 1, 1, 0],
    );
    assert.ok(result.data!.exclusions.every((item) => item.reason && item.undatedCount === 0));
    const outside = (await analysis(c.db, { ...query, fromDay: '2020-01-01', toDay: '2020-01-01' })).duration;
    assert.ok(outside.data!.exclusions.every((item) => item.count === 0));
  } finally {
    await c.dispose();
  }
});

test('analysis duration includes short-closed orders with shipments using the final shipment time', async () => {
  const c = await shipmentFixture();
  try {
    await c.ship(20);
    await c.ship(30);
    await c.send(`${c.path}/short-close`, { ...version(await c.current()), reason: '余量不再发货' }).expect(200);
    await c.db.run(
      `UPDATE outbound_orders o JOIN
      (SELECT order_id,MAX(shipped_at) AS at FROM outbound_shipments GROUP BY order_id) f ON f.order_id=o.id
      SET o.created_at=DATE_SUB(f.at,INTERVAL 5 HOUR),o.short_closed_at=DATE_ADD(f.at,INTERVAL 1 HOUR) WHERE o.id=?`,
      [c.order.id],
    );
    await c.db.run(
      'UPDATE outbound_shipments SET shipped_at=DATE_SUB(shipped_at,INTERVAL 2 HOUR) WHERE order_id=? AND seq=1',
      [c.order.id],
    );
    const result = (await analysis(c.db, { fromDay: shanghaiToday(), toDay: shanghaiToday(), basis: 'posted' }))
      .duration;
    assert.equal(result.data!.outboundCompleted, 1);
    assert.equal(result.data!.outboundAverageHours, 5);
    assert.ok(result.data!.exclusions.every((item) => item.count === 0 && item.undatedCount === 0));
    assert.notEqual(result.data!.longestPending?.number, c.order.orderNo);
  } finally {
    await c.dispose();
  }
});

test('analysis duration excludes zero-shipment short closures and increments their response count', async () => {
  const c = await shipmentFixture();
  try {
    const completed = await prepared(c.db, 'outbound');
    await c.db.run(
      `UPDATE outbound_orders o JOIN
      (SELECT order_id,MAX(shipped_at) AS at FROM outbound_shipments GROUP BY order_id) f ON f.order_id=o.id
      SET o.created_at=DATE_SUB(f.at,INTERVAL 5 HOUR) WHERE o.id=?`,
      [completed.id],
    );
    // The business command rejects this state; inject it only in the disposable test database.
    await c.db.run("UPDATE outbound_orders SET status='short_closed',short_closed_at=UTC_TIMESTAMP(3) WHERE id=?", [
      c.order.id,
    ]);
    const query = { fromDay: shanghaiToday(), toDay: shanghaiToday(), basis: 'posted' as const };
    const response = await c.web.get('/api/v1/web/analysis').query(query).expect(200);
    const result = response.body.data.duration;
    assert.equal(result.data.outboundCompleted, 1);
    assert.equal(result.data.outboundAverageHours, 5);
    assert.deepEqual(result.data.exclusions.at(-1), {
      kind: 'outbound',
      reason: '出库单短关但没有发货，不计入确认时长',
      count: 1,
      undatedCount: 0,
    });
    assert.equal(result.verification, 'verified');
    await c.db.run('UPDATE outbound_orders SET short_closed_at=NULL WHERE id=?', [c.order.id]);
    const undated = (await analysis(c.db, query)).duration;
    assert.equal(undated.data!.exclusions.at(-1)!.undatedCount, 1);
    assert.equal(undated.data!.exclusions.at(-1)!.count, 0);
    assert.equal(undated.verification, 'unverifiable');
    assert.ok(undated.reason);
  } finally {
    await c.dispose();
  }
});
