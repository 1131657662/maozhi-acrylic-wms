import test from 'node:test';
import assert from 'node:assert/strict';
import { reportDetailsSchema, reportMonthlySchema } from '@wms/contracts';
import { reportFixture, reportParams } from './report-fixture.ts';

test('B3b: three months per warehouse/product reconcile and detail cells match monthly', async () => {
  const f = await reportFixture();
  try {
    const read = async (kind: string) =>
      (
        await f.api
          .get('/api/v1/web/reports/' + kind)
          .query(reportParams)
          .set('Cookie', f.cookie)
          .expect(200)
      ).body.data;
    const monthly = reportMonthlySchema.parse(await read('monthly')),
      details = reportDetailsSchema.parse(await read('details'));
    assert.equal(monthly.items.length, 18);
    assert.equal(details.items.length, 48);
    for (const row of monthly.items) {
      assert.equal(row.differencePackages, 0);
      assert.equal(row.differenceGrams, 0);
      assert.equal(row.checkState, '可验证');
      assert.equal(
        row.closingPackages,
        row.openingPackages! +
          row.inboundPackages -
          row.outboundPackages +
          row.adjustmentPackages +
          row.otherMovementPackages,
      );
      const events = details.items.filter(
        (d) =>
          d.warehouseCode === row.warehouseCode &&
          d.productCode === row.productCode &&
          new Date(Date.parse(d.postedAt!) + 8 * 3600000).toISOString().startsWith(row.period),
      );
      for (const direction of ['inbound', 'outbound'] as const) {
        const group = events.filter((d) => d.directionLabel === (direction === 'inbound' ? '入库' : '出库'));
        assert.equal(
          group.reduce((sum, d) => sum + d.packages, 0),
          row[`${direction}Packages`],
        );
        assert.equal(
          group.reduce((sum, d) => sum + d.weightGrams, 0),
          row[`${direction}Grams`],
        );
      }
    }
    const january = monthly.items.find((r) => r.period === '2026-01')!,
      march = monthly.items.find((r) => r.period === '2026-03')!;
    assert.equal(january.inboundPackages, 20);
    assert.equal(march.inboundReversedPackages, -8);
    assert.equal(march.outboundReversedGrams, -1_180_000);
    assert.equal(march.countPackages, 0);
    assert.equal(march.countGrams, 1000);
    assert.equal(details.report.excludedDeleted, 6);
    assert.equal(details.report.timeStatus, '时间未核实');
    assert.equal(details.items.find((d) => d.operationType === 'inbound')!.postedAt, '2026-01-05T15:45:00.000Z');
    assert.deepEqual(monthly.report, details.report);
    const inbound = await f.api
      .get('/api/v1/web/reports/details')
      .query({ ...reportParams, movement: 'inbound' })
      .set('Cookie', f.cookie)
      .expect(200);
    assert.equal(inbound.body.data.total, 24);
    assert.ok(inbound.body.data.items.every((row: { directionLabel: string }) => row.directionLabel === '入库'));
    assert.deepEqual(inbound.body.data.report, monthly.report);
    await f.api
      .get('/api/v1/web/reports/monthly')
      .query({ ...reportParams, movement: 'inbound' })
      .set('Cookie', f.cookie)
      .expect(422);
    console.log(
      'B3B_RECONCILIATION',
      JSON.stringify({
        months: 3,
        cells: 18,
        detailRows: 48,
        mismatches: 0,
        deletedExcluded: 6,
        time: 'historical Shanghai unchanged',
      }),
    );
  } finally {
    await f.dispose();
  }
});

test('B3b: gaps stay unverifiable with visible difference; unknown opening is null', async () => {
  const f = await reportFixture();
  try {
    const response = await f.api
      .get('/api/v1/web/reports/monthly')
      .query({ ...reportParams, product: 'RPT-GAP' })
      .set('Cookie', f.cookie)
      .expect(200);
    const data = reportMonthlySchema.parse(response.body.data),
      march = data.items.find((r) => r.period === '2026-03')!;
    assert.equal(march.checkState, '不可验证');
    assert.equal(march.differencePackages, 1);
    assert.equal(march.differenceGrams, 300000);
    assert.equal(march.adjustmentPackages, 0);
    assert.ok(march.reasons.some((r) => r.includes('相邻库存记录的前后数量不衔接')));
    const before = await f.api
      .get('/api/v1/web/reports/monthly')
      .query({ ...reportParams, fromDay: '2025-12-01', toDay: '2025-12-31' })
      .set('Cookie', f.cookie)
      .expect(200);
    assert.equal(before.body.data.report.reconciliation.openingPackages, null);
    assert.equal(before.body.data.report.reconciliation.differencePackages, null);
    console.log(
      'B3B_GAP',
      JSON.stringify({
        differencePackages: march.differencePackages,
        differenceGrams: march.differenceGrams,
        adjustment: 0,
        state: march.checkState,
        missingOpening: null,
      }),
    );
  } finally {
    await f.dispose();
  }
});

test('B3b: source guard, date validation, and mobile authorization are fail-closed', async () => {
  const f = await reportFixture();
  try {
    for (const query of [
      { ...reportParams, source: 'all' },
      { ...reportParams, total: 'true' },
      { ...reportParams, toDay: '2099-01-01' },
      { ...reportParams, fromDay: '2026-02-30' },
    ])
      await f.api.get('/api/v1/web/reports/monthly').query(query).set('Cookie', f.cookie).expect(422);
    for (const channel of ['miniapp', 'pda']) {
      const login = await f.api
        .post('/api/v1/auth/login')
        .send({ username: 'owner', password: 'test-only-password', channel })
        .expect(200);
      await f.api
        .get('/api/v1/web/reports/monthly')
        .query(reportParams)
        .set('Authorization', 'Bearer ' + login.body.data.token)
        .expect(403);
    }
    console.log('B3B_GUARDS source/date=422 mobile=403');
  } finally {
    await f.dispose();
  }
});
