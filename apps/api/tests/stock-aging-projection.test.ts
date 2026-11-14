import { test } from 'node:test';
import assert from 'node:assert/strict';
import { projectStockAging } from '../src/features/stock/aging-projection.ts';
import { ageBuckets, applyFifo, emptyFifo } from '../src/features/reports/fifo.ts';
import { agingEvent, AGING_AS_OF } from './stock-aging-fixture.ts';

const stock = (weightGrams: number) => ({ packages: 0, weightGrams, sourceRow: null });
for (const [days, index] of [
  [0, 0],
  [30, 0],
  [31, 1],
  [60, 1],
  [61, 2],
  [90, 2],
  [91, 3],
  [180, 3],
  [181, 4],
  [500, 4],
]) {
  test(`库存库龄边界 ${days} 天仅落入第 ${index! + 1} 档，克数无误差`, () => {
    const time = new Date(Date.parse(AGING_AS_OF) - days! * 86400000);
    const event = agingEvent({
      localTime: time.toISOString().slice(0, 19).replace('T', ' '),
      postedAt: time.toISOString(),
    });
    const result = projectStockAging([event], stock(1_000_000), AGING_AS_OF);
    const expected = [0, 0, 0, 0, 0];
    expected[index!] = 1_000_000;
    assert.deepEqual(result, { agingBuckets: expected, unagingGrams: 0 });
  });
}

test('部分 FIFO 耗用和出库撤销恢复原年龄；旧报表分档不变', () => {
  const old = agingEvent({
    id: '1',
    operationId: 'old',
    localTime: '2026-08-31 12:00:00',
    postedAt: '2026-08-31T04:00:00Z',
  });
  const fresh = agingEvent({ id: '2', operationId: 'fresh', beforeGrams: 1_000_000, afterGrams: 2_000_000 });
  const out = agingEvent({
    id: '3',
    operationId: 'out',
    family: 'outbound',
    operationType: 'outbound.confirm',
    weightGrams: 500_000,
    deltaGrams: -500_000,
    beforeGrams: 2_000_000,
    afterGrams: 1_500_000,
  });
  const events = [old, fresh, out];
  assert.deepEqual(projectStockAging(events, stock(1_500_000), AGING_AS_OF), {
    agingBuckets: [1_000_000, 0, 500_000, 0, 0],
    unagingGrams: 0,
  });
  const fifo = emptyFifo();
  for (const event of events) applyFifo(fifo, event, event.afterGrams);
  assert.deepEqual(ageBuckets(fifo, '2026-11-14', 1_500_000), [1_000_000, 500_000, 0, 0, 0, 0]);
  events.push(
    agingEvent({
      id: '4',
      family: 'outbound',
      reverse: true,
      operationType: 'outbound.reverse',
      originalOperationId: 'out',
      deltaGrams: 500_000,
      weightGrams: -500_000,
      beforeGrams: 1_500_000,
      afterGrams: 2_000_000,
    }),
  );
  assert.deepEqual(projectStockAging(events, stock(2_000_000), AGING_AS_OF), {
    agingBuckets: [1_000_000, 0, 1_000_000, 0, 0],
    unagingGrams: 0,
  });
});

for (const [name, overrides] of [
  ['人工调整', { family: 'manual', operationType: 'stock.adjust' }],
  ['盘点', { family: 'count', operationType: 'stocktake.post' }],
  ['缺时间', { localTime: null, postedAt: null }],
  ['未知期初', { beforeGrams: 1_000_000, deltaGrams: 0, weightGrams: 0 }],
  ['无关联撤销', { family: 'outbound', reverse: true, operationType: 'outbound.reverse', weightGrams: -1_000_000 }],
] as const)
  test(`${name} 不伪造年龄，余额全部进入不可归龄`, () => {
    assert.deepEqual(projectStockAging([agingEvent(overrides)], stock(1_000_000), AGING_AS_OF), {
      agingBuckets: [0, 0, 0, 0, 0],
      unagingGrams: 1_000_000,
    });
  });

test('未知池可证归零后可靠新层恢复，负库存原值保留', () => {
  const events = [
    agingEvent({ family: 'manual', operationType: 'stock.adjust' }),
    agingEvent({
      family: 'manual',
      operationType: 'stock.adjust',
      beforeGrams: 1_000_000,
      afterGrams: 0,
      deltaGrams: -1_000_000,
    }),
    agingEvent({ id: '3', operationId: 'recovered' }),
  ];
  assert.deepEqual(projectStockAging(events, stock(1_000_000), AGING_AS_OF), {
    agingBuckets: [1_000_000, 0, 0, 0, 0],
    unagingGrams: 0,
  });
  assert.deepEqual(projectStockAging([], stock(-100), AGING_AS_OF), {
    agingBuckets: [0, 0, 0, 0, 0],
    unagingGrams: -100,
  });
});

test('末值不符或未来时间不伪造年龄，零库存六项皆为零', () => {
  const result = projectStockAging([agingEvent()], stock(900_000), AGING_AS_OF);
  assert.deepEqual(result, { agingBuckets: [0, 0, 0, 0, 0], unagingGrams: 900_000 });
  assert.equal(
    projectStockAging([agingEvent({ postedAt: '2099-01-01T00:00:00Z' })], stock(1_000_000), AGING_AS_OF).unagingGrams,
    1_000_000,
  );
  assert.deepEqual(projectStockAging([], stock(0), AGING_AS_OF), { agingBuckets: [0, 0, 0, 0, 0], unagingGrams: 0 });
});
