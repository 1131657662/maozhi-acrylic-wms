import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { listFields, reportAgingSchema, reportTurnoverSchema } from '@wms/contracts';
import { restatedFixture, restatedQuery, appendDateCorrection } from './restated-fixture.ts';
import { waitExport } from './export-fixture.ts';
import { actor } from './fixture.ts';

test('B5d-2 invalid basis, invalid or future cutoff reject with 422', async () => {
  const f = await restatedFixture();
  try {
    for (const extra of [{ basis: 'business' }, { asOf: '2026-01-01' }, { asOf: '2099-01-01T00:00:00Z' }])
      await f.api
        .get('/api/v1/web/reports/monthly')
        .query({ ...restatedQuery, ...extra })
        .set('Cookie', f.cookie)
        .expect(422);
  } finally {
    await f.dispose();
  }
});
test('B5d-2 initialization without an original document keeps its posting period with an exception reason', async () => {
  const f = await restatedFixture();
  try {
    const result = await f.read({ basis: 'restated', fromDay: '2025-12-01' });
    const row = result.bridge!.find((item) => item.category === '期初')!;
    assert.equal(row.month, '2025-12');
    assert.equal(row.postedPackages, 100);
    assert.equal(row.restatedPackages, 100);
    assert.equal(row.deltaPackages, 0);
    assert.match(row.reason!, /自身入账日/);
  } finally {
    await f.dispose();
  }
});
test('B5d-2 unknown posting time is not lost from the closed bridge', async () => {
  const f = await restatedFixture();
  try {
    await f.db
      .run(`UPDATE stock_journal SET source_id='B5D2-NO-TIME',source_business_type='inbound',source_row_json='{}'
      WHERE inbound_receipt_id='B5D2-IN'`);
    const result = await f.read({ basis: 'restated' }),
      unknown = result.bridge!.find((row) => row.month === null)!;
    assert.equal(unknown.postedPackages, 10);
    assert.equal(unknown.deltaPackages, -10);
    assert.match(unknown.reason!, /入账时间/);
    assert.equal(
      result.bridge!.reduce((sum, row) => sum + row.deltaPackages, 0),
      0,
    );
  } finally {
    await f.dispose();
  }
});
test('B5d-2 turnover and aging keep posting inventory sequences and export the same view', async () => {
  const f = await restatedFixture();
  try {
    await appendDateCorrection(f.db);
    for (const kind of ['report-turnover', 'report-aging'] as const) {
      const query = { ...restatedQuery, ...(kind === 'report-aging' ? { cutoffDay: '2026-02-28' } : {}) };
      const schema = kind === 'report-aging' ? reportAgingSchema : reportTurnoverSchema;
      const read = async (basis: string) =>
        schema.parse(
          (
            await f.api
              .get(`/api/v1/web/reports/${kind.slice(7)}`)
              .query({ ...query, basis })
              .set('Cookie', f.cookie)
              .expect(200)
          ).body.data,
        );
      const posted = await read('posted'),
        restated = await read('restated');
      const inventoryValues = (items: typeof posted.items) =>
        items.map(({ ...row }) => {
          if ('formula' in row) row.formula = '';
          return row;
        });
      assert.deepEqual(inventoryValues(restated.items), inventoryValues(posted.items));
      assert.deepEqual(restated.totals, posted.totals);
      assert.equal(restated.inventoryBasis, 'posted');
      const job = await f.service.create(
        {
          requestId: randomUUID(),
          kind,
          scope: 'all',
          query: { ...query, basis: 'restated', asOf: restated.watermarks.asOf },
          columns: listFields[kind].map((field) => field.key),
          viewToken: restated.viewToken,
          selected: [],
        },
        actor,
      );
      const ready = await waitExport(f, job.id);
      assert.equal(ready.state, 'ready', ready.error ?? '');
      assert.deepEqual(ready.watermarks, restated.watermarks);
      assert.deepEqual(ready.bridge, restated.bridge);
    }
  } finally {
    await f.dispose();
  }
});
