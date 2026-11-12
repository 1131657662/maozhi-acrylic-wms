import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import type { ReportBridgeRow } from '@wms/contracts';
import { appendDateCorrection, firstCorrectionId, restatedFixture, priorReportFields } from './restated-fixture.ts';

function assertConserved(rows: ReportBridgeRow[]): void {
  assert.equal(
    rows.reduce((sum, row) => sum + row.deltaPackages, 0),
    0,
  );
  assert.equal(
    rows.reduce((sum, row) => sum + row.deltaGrams, 0),
    0,
  );
}
test('B5d-2 default posted fields equal the pre-change 3348e30 baseline', async () => {
  const f = await restatedFixture();
  try {
    const baseline = JSON.parse(readFileSync(new URL('./posted-report-baseline.json', import.meta.url), 'utf8'));
    assert.equal(baseline.commit, '3348e303bb85bf8fbfb2306667dc4ec2e854b20e');
    assert.deepEqual(priorReportFields(await f.read()), baseline.monthly);
    assert.deepEqual(priorReportFields(await f.details()), baseline.details);
    assert.deepEqual(priorReportFields(await f.read({ basis: 'posted' })), baseline.monthly);
  } finally {
    await f.dispose();
  }
});
test('B5d-2 cross-month restatement preserves posted results and bridges both months', async () => {
  const f = await restatedFixture();
  try {
    const before = await f.read(),
      detailsBefore = await f.details();
    await appendDateCorrection(f.db);
    assert.deepEqual(priorReportFields(await f.read()), priorReportFields(before));
    assert.deepEqual(priorReportFields(await f.details()), priorReportFields(detailsBefore));
    const result = await f.read({ basis: 'restated' });
    assert.deepEqual(
      result.items.map((row) => [row.period, row.inboundPackages]),
      [
        ['2026-01', 0],
        ['2026-02', 10],
      ],
    );
    assert.deepEqual(
      result.bridge!.map((row) => [row.month, row.category, row.deltaPackages, row.deltaGrams]),
      [
        ['2026-01', '入库', -10, -1234500],
        ['2026-02', '入库', 10, 1234500],
      ],
    );
    assertConserved(result.bridge!);
    const detail = (await f.details({ basis: 'restated' })).items[0]!;
    assert.equal(detail.businessDate, '2026-01-15');
    assert.equal(detail.effectiveBusinessDate, '2026-02-15');
    assert.equal(detail.postedAt, '2026-01-15T02:00:00.000Z');
  } finally {
    await f.dispose();
  }
});
test('B5d-2 February-only bridge retains January outside the range', async () => {
  const f = await restatedFixture();
  try {
    await appendDateCorrection(f.db);
    const result = await f.read({ basis: 'restated', fromDay: '2026-02-01' });
    assert.deepEqual(
      result.bridge!.map((row) => [row.month, row.inRange, row.deltaPackages]),
      [
        ['2026-01', false, -10],
        ['2026-02', true, 10],
      ],
    );
    assertConserved(result.bridge!);
    assert.equal(result.items[0]!.inboundPackages, 10);
    assert.equal(result.report.reconciliation.inboundPackages, 0);
  } finally {
    await f.dispose();
  }
});
test('B5d-2 unknown original date retains quantities in an unassigned bridge row', async () => {
  const f = await restatedFixture();
  try {
    await f.db.run("UPDATE inbound_receipts SET business_date=NULL WHERE id='B5D2-IN'");
    const result = await f.read({ basis: 'restated' }),
      unknown = result.bridge!.find((row) => row.month === null)!;
    assert.equal(unknown.restatedPackages, 10);
    assert.equal(unknown.restatedGrams, 1234500);
    assert.equal(unknown.inRange, false);
    assert.match(unknown.reason!, /原单业务日期缺失/);
    assertConserved(result.bridge!);
    const detail = (await f.details({ basis: 'restated' })).items[0]!;
    assert.equal(detail.reportingDate, null);
    assert.equal(detail.packages, 10);
  } finally {
    await f.dispose();
  }
});
test('B5d-2 switching basis preserves actual balances and keeps unproved restated balances null', async () => {
  const f = await restatedFixture();
  try {
    await appendDateCorrection(f.db);
    const posted = await f.read(),
      restated = await f.read({ basis: 'restated' });
    assert.equal(posted.balanceMode, 'posted');
    assert.equal(restated.balanceMode, 'unverifiable');
    assert.deepEqual(restated.report.reconciliation, posted.report.reconciliation);
    for (let index = 0; index < posted.items.length; index++) {
      const row = restated.items[index]!,
        original = posted.items[index]!;
      for (const field of [
        'openingPackages',
        'openingGrams',
        'closingPackages',
        'closingGrams',
        'differencePackages',
        'differenceGrams',
      ] as const) {
        assert.equal(row[field], original[field]);
        assert.equal(row.postedBalance![field], original[field]);
        assert.equal(row.restatedBalance![field], null);
      }
    }
    assert.ok(restated.restatedBalance!.reasons.some((reason) => reason.includes('锚点')));
  } finally {
    await f.dispose();
  }
});
test('B5d-2 asOf selects date revisions, not UUID order, and caps committed event quantities', async () => {
  const f = await restatedFixture();
  try {
    await appendDateCorrection(f.db);
    await appendDateCorrection(f.db, 2);
    const early = await f.read({ basis: 'restated', asOf: '2026-02-01T00:00:00+08:00' });
    assert.equal(early.watermarks.dateCorrectionMaxId, null);
    assert.equal(early.items[0]!.inboundPackages, 10);
    const middle = await f.read({ basis: 'restated', asOf: '2026-03-15T00:00:00Z' });
    assert.equal(middle.items[1]!.inboundPackages, 10);
    const latest = await f.read({ basis: 'restated', toDay: '2026-03-31' });
    assert.equal(latest.watermarks.dateCorrectionMaxId, firstCorrectionId);
    assert.equal(latest.items[2]!.inboundPackages, 10);
    assert.equal(latest.items[1]!.inboundPackages, 0);
    const beforePosting = await f.read({ asOf: '2026-01-01T00:00:00Z' });
    assert.equal(beforePosting.report.reconciliation.inboundPackages, 0);
    assert.equal((await f.details({ asOf: '2026-01-01T00:00:00Z' })).total, 0);
    assert.equal((await f.details({ asOf: '2026-01-15T02:00:00.000Z' })).total, 1);
  } finally {
    await f.dispose();
  }
});
