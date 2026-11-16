import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { reportMonthlySchema, workbenchSchema, shanghaiToday } from '@wms/contracts';
import { correctionFixture } from './correction-fixture.ts';
import { origin } from './numbering-fixture.ts';
import { prepared } from './lifecycle-fixture.ts';

type Context = Awaited<ReturnType<typeof correctionFixture>>;
async function compare(c: Context, group: string) {
  const dashboard = workbenchSchema.parse((await c.web.get('/api/v1/web/dashboard').expect(200)).body.data);
  const report = reportMonthlySchema.parse(
    (
      await c.web
        .get('/api/v1/web/reports/monthly')
        .query({
          scope: 'inventory',
          fromDay: shanghaiToday(),
          toDay: shanghaiToday(),
          basis: 'posted',
          asOf: dashboard.asOf,
        })
        .expect(200)
    ).body.data,
  );
  assert.equal(dashboard.today.verification, 'verified');
  const totals = report.chart.totals;
  for (const kind of ['inbound', 'outbound'] as const) {
    assert.equal(dashboard.today.data![kind].packages.value, totals[`${kind}Packages`]);
    assert.equal(dashboard.today.data![kind].grams.value, totals[`${kind}Grams`]);
  }
  console.log('B7B_REPORT_COMPARISON', JSON.stringify({ group, asOf: dashboard.asOf, totals }));
  return dashboard;
}
test('B7b report comparison groups 1/2: confirmations and corrections', async () => {
  const c = await correctionFixture('inbound');
  try {
    await prepared(c.db, 'outbound');
    await compare(c, '确认收发');
    await c.post(await c.input({ packages: 1, weightGrams: 100000 })).expect(200);
    const data = await compare(c, '数量更正');
    assert.equal(data.today.data!.inbound.grams.value, 402500);
    assert.equal(data.today.data!.outbound.grams.value, 600000);
  } finally {
    await c.dispose();
  }
});
test('B7b report comparison group 3: corrected reversal, cross-day sample', async () => {
  const c = await correctionFixture('outbound');
  try {
    await c.db.run("UPDATE outbound_orders SET bill_type='sample' WHERE id=?", [c.target.id]);
    await c.post(await c.input({ packages: 1, weightGrams: 100000 })).expect(200);
    const preview = (await c.web.get(`${c.path}/lifecycle`).expect(200)).body.data;
    assert.equal(preview.allowed, true);
    await c.web
      .post(`${c.path}/reverse`)
      .set('origin', origin)
      .set('idempotency-key', randomUUID())
      .send({ reason: '工作台同口径验收', expectedToken: preview.token })
      .expect(200);
    await c.db.run(
      "UPDATE inventory_operations SET created_at=DATE_SUB(UTC_TIMESTAMP(3),INTERVAL 1 DAY) WHERE operation_type='outbound.confirm'",
    );
    const data = await compare(c, '更正后撤销与跨日样品');
    assert.equal(data.today.data!.outbound.grams.value, -600000);
    assert.ok(data.trend14d.data!.some((p) => p.outbound.grams.value === 600000));
  } finally {
    await c.dispose();
  }
});
