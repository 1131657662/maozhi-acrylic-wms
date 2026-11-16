import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { analysisSchema, reportMonthlySchema, shanghaiToday } from '@wms/contracts';
import { correctionFixture } from './correction-fixture.ts';
import { prepared } from './lifecycle-fixture.ts';
import { origin } from './numbering-fixture.ts';
import { dateFixture, dateInput, shiftedDate } from './date-correction-fixture.ts';

async function compare(c: Awaited<ReturnType<typeof correctionFixture>>, group: string) {
  const range = { fromDay: shanghaiToday(), toDay: shanghaiToday(), basis: 'posted' },
    data = analysisSchema.parse((await c.web.get('/api/v1/web/analysis').query(range).expect(200)).body.data),
    report = reportMonthlySchema.parse(
      (
        await c.web
          .get('/api/v1/web/reports/monthly')
          .query({ ...range, scope: 'inventory', asOf: data.asOf })
          .expect(200)
      ).body.data,
    );
  assert.equal(data.comparison.verification, 'verified');
  assert.equal(data.comparison.data!.current.inboundGrams, report.chart.totals.inboundGrams);
  assert.equal(data.comparison.data!.current.outboundGrams, report.chart.totals.outboundGrams);
  console.log('B7B2_REPORT_COMPARISON', JSON.stringify({ group, asOf: data.asOf, totals: report.chart.totals }));
  return data;
}

test('analysis agrees with reports for confirmed flows and quantity corrections', async () => {
  const c = await correctionFixture('inbound');
  try {
    await prepared(c.db, 'outbound');
    await compare(c, '确认收发');
    await c.post(await c.input({ packages: 1, weightGrams: 100000 })).expect(200);
    const data = await compare(c, '数量更正');
    assert.equal(data.comparison.data!.current.inboundGrams, 402500);
    assert.equal(data.comparison.data!.current.outboundGrams, 600000);
  } finally {
    await c.dispose();
  }
});

test('analysis preserves cross-day sample reversal as negative net outbound', async () => {
  const c = await correctionFixture('outbound');
  try {
    await c.db.run("UPDATE outbound_orders SET bill_type='sample' WHERE id=?", [c.target.id]);
    await c.post(await c.input({ packages: 1, weightGrams: 100000 })).expect(200);
    const preview = (await c.web.get(`${c.path}/lifecycle`).expect(200)).body.data;
    await c.web
      .post(`${c.path}/reverse`)
      .set('origin', origin)
      .set('idempotency-key', randomUUID())
      .send({ reason: '看板同口径验收', expectedToken: preview.token })
      .expect(200);
    await c.db.run(
      "UPDATE inventory_operations SET created_at=DATE_SUB(UTC_TIMESTAMP(3),INTERVAL 1 DAY) WHERE operation_type='outbound.confirm'",
    );
    const data = await compare(c, '更正后撤销与跨日样品');
    assert.equal(data.comparison.data!.current.outboundGrams, -600000);
    assert.equal(data.heatmap.data!.days.at(-1)!.outboundGrams, -600000);
  } finally {
    await c.dispose();
  }
});

test('analysis restated dates follow date correction evidence and cache basis stays separate', async () => {
  const c = await dateFixture('outbound');
  try {
    const today = shanghaiToday(),
      yesterday = shiftedDate(today, -1);
    await c.send(dateInput(yesterday)).expect(200);
    for (const basis of ['posted', 'restated']) {
      const range = { fromDay: yesterday, toDay: yesterday, basis },
        data = analysisSchema.parse((await c.web.get('/api/v1/web/analysis').query(range).expect(200)).body.data),
        report = reportMonthlySchema.parse(
          (
            await c.web
              .get('/api/v1/web/reports/monthly')
              .query({ ...range, scope: 'inventory', asOf: data.asOf })
              .expect(200)
          ).body.data,
        );
      assert.equal(data.comparison.data!.current.outboundGrams, report.chart.totals.outboundGrams);
      assert.equal(data.comparison.data!.current.outboundGrams, basis === 'posted' ? 0 : 302500);
      assert.equal(data.heatmap.data!.days.at(-1)!.outboundGrams, basis === 'posted' ? 0 : 302500);
    }
  } finally {
    await c.dispose();
  }
});
