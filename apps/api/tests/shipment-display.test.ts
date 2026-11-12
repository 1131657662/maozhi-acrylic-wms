import { test } from 'node:test';
import assert from 'node:assert/strict';
import { shipmentFixture, version } from './multi-shipment-fixture.ts';
import { correctionInput, shipmentCorrectionFixture } from './shipment-correction-fixture.ts';
import { shipmentDisplay } from '../src/features/shipments/display.ts';
import { fact } from './fixture.ts';

test('B5c-3 query returns effective and remaining quantities after correction and short close', async () => {
  const c = await shipmentCorrectionFixture();
  try {
    await c.send(`${c.path}/corrections`, await correctionInput(c, 2, 40)).expect(200);
    const partial = await c.records();
    assert.equal(partial.effectivePackages, 80);
    assert.equal(partial.remainingPackages, 20);
    assert.equal(partial.lines[0]!.effectivePackages, 80);
    assert.equal(partial.lines[0]!.remainingWeightGrams, 6000000);
    assert.equal(partial.items[1]!.packages, 60);
    assert.equal(partial.items[1]!.effectivePackages, 40);
    await c.send(`${c.path}/short-close`, { ...version(await c.current()), reason: '客户取消' }).expect(200);
    const closed = await c.records();
    assert.equal(closed.lines[0]!.remainingPackages, 0);
    assert.equal(closed.lines[0]!.remainingWeightGrams, 0);
    assert.equal(closed.shortClosure?.packages, 20);
    assert.equal(closed.effectivePackages, 80);
  } finally {
    await c.dispose();
  }
});

test('B5c-3 prefill subtracts effective packages before distributing scans across repeated products', async () => {
  const c = await shipmentFixture();
  try {
    const base = await c.current();
    const line = base.lines[0]!;
    const order = {
      ...base,
      corrections: null,
      lines: [
        {
          ...line,
          id: 'first',
          plannedPackages: 4,
          plannedWeightGrams: 1200000,
          actualPackages: 3,
          actualWeightGrams: 900000,
        },
        {
          ...line,
          id: 'second',
          plannedPackages: 3,
          plannedWeightGrams: 900000,
          actualPackages: 0,
          actualWeightGrams: 0,
        },
      ],
      facts: Array.from({ length: 6 }, () => ({
        ...fact({ weightGrams: 300000 }),
        planId: base.id,
        recordedBy: 'owner',
        receivedAt: new Date().toISOString(),
        productCode: line.productCode,
      })),
    };
    const view = shipmentDisplay(order);
    assert.deepEqual(
      view.lines.map((l) => [l.prefillPackages, l.prefillWeightGrams]),
      [
        [1, 300000],
        [2, 600000],
      ],
    );
    assert.deepEqual(
      view.lines.map((l) => [l.remainingPackages, l.remainingWeightGrams]),
      [
        [1, 300000],
        [3, 900000],
      ],
    );
    assert.equal(shipmentDisplay({ ...order, facts: [] }).lines[0]!.prefillPackages, null);
    assert.equal(shipmentDisplay({ ...order, facts: [] }).lines[0]!.prefillWeightGrams, null);
  } finally {
    await c.dispose();
  }
});
