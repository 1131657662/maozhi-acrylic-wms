import test from 'node:test';
import assert from 'node:assert/strict';
import { analysisSchema, reportMonthlySchema } from '@wms/contracts';
import { reportFixture } from './report-fixture.ts';

test('analysis dashboard matches monthly report totals and has fixed ranges', async () => {
  const f = await reportFixture();
  try {
    const range = { fromDay: '2026-01-01', toDay: '2026-03-31' },
      analysisResponse = await f.api.get('/api/v1/web/analysis').query(range).set('Cookie', f.cookie).expect(200),
      data = analysisSchema.parse(analysisResponse.body.data),
      reportResponse = await f.api
        .get('/api/v1/web/reports/monthly')
        .query({ ...range, scope: 'inventory', basis: 'posted', pageSize: '200' })
        .set('Cookie', f.cookie)
        .expect(200),
      report = reportMonthlySchema.parse(reportResponse.body.data);

    assert.equal(data.basis, 'posted');
    assert.equal(data.monthly.data?.points.length, 12);
    assert.equal(data.heatmap.data?.days.length, 183);
    assert.equal(data.comparison.data?.current.inboundGrams, report.chart.totals.inboundGrams);
    assert.equal(data.comparison.data?.current.outboundGrams, report.chart.totals.outboundGrams);
    assert.ok(data.heatmap.data?.days.some((day) => day.value === 0));
    assert.ok(data.tops.data);
    assert.ok(data.tops.data.products.length <= 10);

    const second = await f.api
      .get('/api/v1/web/analysis')
      .query({ ...range, basis: 'restated' })
      .set('Cookie', f.cookie)
      .expect(200);
    assert.equal(analysisSchema.parse(second.body.data).basis, 'restated');
  } finally {
    await f.dispose();
  }
});

test('analysis rejects invalid ranges and non-Web channels', async () => {
  const f = await reportFixture();
  try {
    await f.api
      .get('/api/v1/web/analysis')
      .query({ fromDay: '2026-03-31', toDay: '2026-01-01' })
      .set('Cookie', f.cookie)
      .expect(422);
    const login = await f.api
      .post('/api/v1/auth/login')
      .send({ username: 'owner', password: 'test-only-password', channel: 'pda' })
      .expect(200);
    await f.api
      .get('/api/v1/web/analysis')
      .query({ fromDay: '2026-01-01', toDay: '2026-01-31' })
      .set('Authorization', `Bearer ${login.body.data.token}`)
      .expect(403);
  } finally {
    await f.dispose();
  }
});
