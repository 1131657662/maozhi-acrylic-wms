import test from 'node:test';
import assert from 'node:assert/strict';
import { shanghaiToday } from '@wms/contracts';
import { numberingFixture } from './numbering-fixture.ts';
import { prepared } from './lifecycle-fixture.ts';
import { analysis } from '../src/features/analysis/cache.ts';
import { createInbound } from '../src/features/inbound/create.ts';
import { newReceipt } from './numbering-fixture.ts';
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

test('analysis duration averages exclude reversed and short-closed documents even with confirmation evidence', async () => {
  const c = await numberingFixture();
  try {
    const inbound = await prepared(c.db, 'inbound'),
      outbound = await prepared(c.db, 'outbound'),
      query = { fromDay: shanghaiToday(), toDay: shanghaiToday(), basis: 'posted' as const };
    await c.db.run("UPDATE inbound_receipts SET posting_state='reversed' WHERE id=?", [inbound.id]);
    for (const status of ['reversed', 'short_closed']) {
      await c.db.run('UPDATE outbound_orders SET status=? WHERE id=?', [status, outbound.id]);
      const result = (await analysis(c.db, query)).duration;
      assert.equal(result.data!.inboundCompleted, 0);
      assert.equal(result.data!.outboundCompleted, 0);
      assert.equal(result.data!.inboundAverageHours, null);
      assert.equal(result.data!.outboundAverageHours, null);
      assert.ok(result.reason);
    }
  } finally {
    await c.dispose();
  }
});
