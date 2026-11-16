import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { fixture, actor } from './fixture.ts';
import { newReceipt } from './numbering-fixture.ts';
import { createInbound } from '../src/features/inbound/create.ts';
import { dashboard } from '../src/features/workbench/cache.ts';
import { readDashboard } from '../src/features/workbench/read.ts';
import { prepareHandoff, handoffPlan } from './handoff-fixture.ts';
import { startHandoff } from '../src/features/handoff/start.ts';
import { registerRecords } from '../src/features/handoff/records.ts';
import { hash } from '../src/shared/hash.ts';
import { seedReportPerformance } from '../../../scripts/report-performance-fixture.ts';
import { prepared } from './lifecycle-fixture.ts';
import { shanghaiToday, workbenchCopy as copy } from '@wms/contracts';

test('B7b one read snapshot stays consistent during a committed write', async () => {
  const c = await fixture();
  try {
    let wrote = false;
    const data = await c.db.readSnapshot(async (tx) => {
      const all = tx.all.bind(tx);
      tx.all = async (sql, values) => {
        const rows = await all(sql, values);
        if (!wrote) {
          wrote = true;
          await createInbound(c.db, newReceipt(), randomUUID(), actor);
        }
        return rows;
      };
      return readDashboard(tx);
    });
    assert.equal(wrote, true, 'Commit after the snapshot header and before block reads');
    assert.equal(data.pending.data!.inbound.count.value, 0);
    assert.equal((await dashboard(c.db)).pending.data!.inbound.count.value, 1);
  } finally {
    await c.dispose();
  }
});
test('B7b handoff UUID/body evidence is deduplicated across registered manifests', async () => {
  const c = await fixture();
  try {
    const { header, records } = await prepareHandoff(c.db);
    for (const id of [header.id, randomUUID()]) {
      await startHandoff(c.db, { ...header, id }, actor);
      await registerRecords(
        c.db,
        id,
        records.map((r) => ({
          planId: handoffPlan,
          rawPayload: r.payload,
          payloadSha: hash(r.payload),
          localState: r.state as 'pending' | 'failed',
        })),
      );
    }
    const data = await dashboard(c.db);
    assert.equal(data.handoffEvidence.data!.unresolved.value, 58);
    assert.equal(data.handoffEvidence.data!.orders.value, 1);
    assert.equal(data.today.data!.outbound.grams.value, 0, 'Scanning and handoff never contribute to stock movements');
  } finally {
    await c.dispose();
  }
});
test('B7b historical midnight is included, invalid dates and unknown products remain unverifiable', async () => {
  const c = await fixture();
  try {
    await seedReportPerformance(c.db, 1);
    await c.db.run(
      "UPDATE stock_journal SET source_row_json=JSON_SET(source_row_json,'$.create_time',?) WHERE source_id='perf-0'",
      [`${shanghaiToday()} 00:00:00`],
    );
    const data = await dashboard(c.db);
    assert.equal(data.today.data!.inbound.grams.value, 300100);
    await c.db.run(
      "UPDATE stock_journal SET source_row_json=JSON_SET(source_row_json,'$.create_time','2026-02-30 00:00:00') WHERE source_id='perf-0'",
    );
    assert.equal((await dashboard(c.db)).today.data!.inbound.grams.value, null);
    await c.db.run("UPDATE stock_journal SET product_code='UNKNOWN-PRODUCT' WHERE source_id='perf-0'");
    assert.equal((await dashboard(c.db)).today.data!.inbound.grams.value, null);
  } finally {
    await c.dispose();
  }
});

test('B7b pending and vehicle labels hide UUIDs while keeping navigable business links', async () => {
  const c = await fixture();
  try {
    const internalId = randomUUID();
    await c.db.run(
      "UPDATE outbound_orders SET order_no=?,vehicle_no=?,warehouse_name_snapshot=?,created_at=UTC_TIMESTAMP(3) WHERE id='DEMO-001'",
      [internalId, internalId, internalId],
    );
    const data = await dashboard(c.db);
    const todo = data.pending.data!.outbound.items.find((item) => item.href === '/outbound/DEMO-001')!;
    assert.equal(todo.number, copy.numberMissing);
    assert.equal(todo.warehouse, copy.warehouseMissing);
    const vehicle = data.vehicleOrders.data!.items.find((item) => item.href === '/outbound/DEMO-001')!;
    assert.equal(vehicle.number, copy.numberMissing);
    assert.equal(vehicle.vehicle, copy.noVehicle);
  } finally {
    await c.dispose();
  }
});

test('B7b one order associated with planned and shipped vehicles counts as one document', async () => {
  const c = await fixture();
  try {
    const target = await prepared(c.db, 'outbound');
    await c.db.run('UPDATE outbound_orders SET vehicle_no=?,created_at=UTC_TIMESTAMP(3) WHERE id=?', [
      '计划车号',
      target.id,
    ]);
    const vehicles = (await dashboard(c.db)).vehicleOrders.data!;
    assert.equal(vehicles.total.value, 1);
    assert.equal(vehicles.items.length, 2);
    assert.equal(new Set(vehicles.items.map((item) => item.href)).size, 1);
    assert.equal(new Set(vehicles.items.map((item) => item.vehicle)).size, 2);
  } finally {
    await c.dispose();
  }
});
