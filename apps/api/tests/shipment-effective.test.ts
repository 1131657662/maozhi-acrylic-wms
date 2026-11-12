import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { Correction } from '@wms/contracts';
import { effectiveLine, effectiveShipment, type EffectiveContext } from '../src/features/corrections/effective.ts';
import type { ShipmentBasis } from '../src/features/corrections/shipment-basis.ts';

const quantity = (packages: number) => ({ packages, weightGrams: packages * 300000 });
const original = { id: 'line', productCode: 'P1', productName: '测试商品', ...quantity(100) };
const shipments: ShipmentBasis[] = [40, 60].map((packages, i) => ({
  shipmentLineId: String(i + 1),
  shipmentId: `shipment${i + 1}`,
  seq: i + 1,
  vehicleNo: '测试车',
  shippedAt: '',
  lineId: 'line',
  productCode: 'P1',
  original: quantity(packages),
  journalId: BigInt(i * 10 + 1),
}));
function correction(input: {
  id?: string;
  target?: string;
  before: number;
  after: number;
  offset?: boolean;
}): Correction {
  return {
    id: input.id ?? 'correction',
    number: 'GZ-001',
    kind: 'outbound',
    originalId: 'order',
    previousCorrectionId: null,
    revision: 1,
    reason: '核对数量',
    actor: 'owner',
    createdAt: '',
    operationId: 'operation',
    offsetOperationId: input.offset ? 'reverse' : null,
    lines: [
      {
        originalLineId: 'line',
        shipmentLineId: input.target ?? null,
        productCode: 'P1',
        before: quantity(input.before),
        after: quantity(input.after),
        delta: quantity(input.after - input.before),
      },
    ],
  };
}
function context(journals: [string, bigint][] = [['correction', 15n]]): EffectiveContext {
  return { shipments, correctionJournals: new Map(journals) };
}
test('effective quantities retain shipment-specific before values when more shipments follow', () => {
  const record = correction({ target: '1', before: 40, after: 30 });
  const result = effectiveLine(original, [record], context([['correction', 5n]]));
  assert.deepEqual(result.effective, quantity(90));
  assert.deepEqual(effectiveShipment(shipments[0]!, [record]).effective, quantity(30));
  assert.deepEqual(effectiveShipment(shipments[1]!, [record]).effective, quantity(60));
});
test('NULL legacy corrections use order quantity at correction time, not future shipments', () => {
  const record = correction({ before: 40, after: 30 });
  assert.deepEqual(effectiveLine(original, [record], context([['correction', 5n]])).effective, quantity(90));
  assert.deepEqual(effectiveShipment(shipments[0]!, [record]).effective, quantity(40));
});
test('legacy order delta and targeted shipment delta are counted once with independent before values', () => {
  const records = [
    correction({ id: 'legacy', before: 100, after: 90 }),
    correction({ target: '2', before: 60, after: 50 }),
  ];
  const result = effectiveLine(
    original,
    records,
    context([
      ['legacy', 12n],
      ['correction', 15n],
    ]),
  );
  assert.deepEqual(result.effective, quantity(80));
  assert.deepEqual(result.delta, quantity(-20));
  assert.deepEqual(effectiveShipment(shipments[1]!, records).effective, quantity(50));
});
test('offset corrections remain verifiable evidence but no longer affect effective quantity', () => {
  const records = [
    correction({ id: 'first', target: '2', before: 60, after: 50, offset: true }),
    correction({ target: '2', before: 50, after: 45, offset: true }),
  ];
  assert.deepEqual(
    effectiveLine(
      original,
      records,
      context([
        ['first', 12n],
        ['correction', 15n],
      ]),
    ).effective,
    quantity(100),
  );
  assert.deepEqual(effectiveShipment(shipments[1]!, records).effective, quantity(60));
});
test('future shipment references and mismatched shipment before quantities are rejected', () => {
  assert.throws(
    () => effectiveLine(original, [correction({ target: '2', before: 60, after: 50 })], context([['correction', 5n]])),
    /尚未发货/,
  );
  assert.throws(
    () => effectiveLine(original, [correction({ target: '2', before: 100, after: 90 })], context()),
    /更正前值/,
  );
});
