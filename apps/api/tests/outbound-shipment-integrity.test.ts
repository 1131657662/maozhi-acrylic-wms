import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { fixture, actor } from './fixture.ts';
import { frozenOrder, failAfter, inventorySnapshot } from './inventory-fixture.ts';
import { getOrder } from '../src/features/outbound/repository.ts';
import { confirmOutbound } from '../src/features/outbound/confirm.ts';
import { createOutboundPlan } from '../src/features/outbound/plans.ts';
import { createCorrection } from '../src/features/corrections/create.ts';
import { lifecyclePreview } from '../src/features/document-lifecycle/preview.ts';
import { executeLifecycle } from '../src/features/document-lifecycle/execute.ts';
import { listWebOutbound } from '../src/features/web-lists/outbound.ts';
import { webOutboundQuerySchema } from '@wms/contracts';

test('B4d manual shipment and scan snapshots roll back on posting failure', async () => {
  const c = await fixture();
  try {
    const order = await frozenOrder(c.db);
    const before = await inventorySnapshot(c.db);
    await failAfter(c.db, 'stock_journal', 'INSERT');
    try {
      await assert.rejects(
        confirmOutbound(c.db, {
          planId: order.id,
          expected: order,
          key: randomUUID(),
          actor,
          lines: [{ lineId: order.lines[0]!.id, actualPackages: 1, actualWeightGrams: 200000 }],
        }),
        /B1A injected failure/,
      );
    } finally {
      await c.db.run('DROP TRIGGER b1a_fail');
    }
    assert.deepEqual(await inventorySnapshot(c.db), before);
    console.log('B4D_ROLLBACK shipment=0 snapshot=null stock_unchanged=true journal=0 success_event=0');
  } finally {
    await c.dispose();
  }
});

test('B4d duplicate product lines support correction and reversal with net zero stock', async () => {
  const c = await fixture();
  try {
    const before = await c.db.get('SELECT packages,weight_tonnes FROM stock');
    const order = await createOutboundPlan(
      c.db,
      {
        customerCode: 'DEMO-CUST-1',
        warehouseCode: 'DEMO-WH',
        vehicleNo: 'B4D',
        lines: [1, 2].map(() => ({ productCode: 'ACR-032', plannedPackages: 1, plannedWeightGrams: 200000 })),
      },
      randomUUID(),
      actor,
    );
    await confirmOutbound(c.db, {
      planId: order.id,
      expected: order,
      key: randomUUID(),
      actor,
      lines: order.lines.map((line) => ({ lineId: line.id, actualPackages: 1, actualWeightGrams: 200000 })),
    });
    const corrected = await createCorrection(c.db, {
      kind: 'outbound',
      id: order.id,
      key: randomUUID(),
      actor,
      input: {
        reason: 'B4d 同商品两行更正',
        expectedCorrectionRevision: 0,
        previousCorrectionId: null,
        lines: order.lines.map((line) => ({ originalLineId: line.id, packages: 2, weightGrams: 300000 })),
      },
    });
    assert.equal(corrected.lines.length, 2);
    const preview = await lifecyclePreview(c.db, { kind: 'outbound', id: order.id });
    assert.equal(preview.allowed, true, JSON.stringify(preview.blockers));
    await executeLifecycle(c.db, {
      kind: 'outbound',
      id: order.id,
      action: 'reverse',
      key: randomUUID(),
      actor,
      input: { reason: 'B4d 同商品两行撤销', expectedToken: preview.token },
    });
    assert.deepEqual(await c.db.get('SELECT packages,weight_tonnes FROM stock'), before);
    assert.equal((await getOrder(c.db, order.id)).actualPackages, 2);
    console.log('B4D_CORRECTION lines=2 confirm=2/400000g corrected=4/600000g reversed_net=0 shipment_immutable=true');
  } finally {
    await c.dispose();
  }
});

test('B4d legacy confirmed list and detail retain scan actual quantities', async () => {
  const c = await fixture();
  try {
    await frozenOrder(c.db);
    // Represents a pre-016 confirmed document without a shipment row.
    await c.db.run("UPDATE outbound_orders SET status='confirmed' WHERE id='DEMO-001'");
    const order = await getOrder(c.db, 'DEMO-001');
    const list = await listWebOutbound(
      c.db,
      webOutboundQuerySchema.parse({ sortBy: 'actualPackages', direction: 'desc' }),
    );
    assert.equal(order.actualPackages, 2);
    assert.equal(order.actualWeightGrams, 600000);
    assert.equal(list.items[0]?.actualPackages, order.actualPackages);
    assert.equal(list.items[0]?.actualWeightGrams, order.actualWeightGrams);
    console.log('B4D_LEGACY shipments=0 detail=2/600000g list=2/600000g');
  } finally {
    await c.dispose();
  }
});
