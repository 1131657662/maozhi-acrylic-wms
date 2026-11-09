import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { shanghaiToday, backdateThreshold } from '@wms/contracts';
import { numberingFixture, newReceipt, newPlan, origin } from './numbering-fixture.ts';
import { businessFingerprint } from './lifecycle-fixture.ts';
import { correctionFixture } from './correction-fixture.ts';

function shifted(date: string, days: number) {
  const result = new Date(`${date}T00:00:00Z`);
  result.setUTCDate(result.getUTCDate() + days);
  return result.toISOString().slice(0, 10);
}
for (const kind of ['inbound', 'outbound'] as const)
  test(`B5a ${kind}业务日期默认/过去/未来/三个月确认`, async () => {
    const c = await numberingFixture();
    try {
      const today = shanghaiToday(),
        old = shifted(backdateThreshold(today), -1);
      const cases = [
        { input: {}, expected: today, status: 200 },
        { input: { businessDate: shifted(today, -1) }, expected: shifted(today, -1), status: 200 },
        { input: { businessDate: shifted(today, 1) }, expected: null, status: 422 },
        { input: { businessDate: old }, expected: null, status: 422 },
        { input: { businessDate: old, backdateConfirmed: true }, expected: old, status: 200 },
        { input: { businessDate: backdateThreshold(today) }, expected: backdateThreshold(today), status: 200 },
      ];
      for (const item of cases) {
        const before = await businessFingerprint(c.db);
        const response = await c.web
          .post(`/api/v1/${kind}`)
          .set('origin', origin)
          .set('idempotency-key', randomUUID())
          .send({ ...(kind === 'inbound' ? newReceipt() : newPlan()), ...item.input })
          .expect(item.status);
        if (item.status === 422) assert.deepEqual(await businessFingerprint(c.db), before);
        else assert.equal(response.body.data.businessDate, item.expected);
        const audit = item.input.backdateConfirmed
          ? await c.db.get('SELECT after_json FROM operation_log WHERE target_id=?', [response.body.data.id])
          : null;
        if (audit) assert.equal(JSON.parse(String(audit.after_json)).businessDateConfirmation.backdateConfirmed, true);
        console.log(
          'B5A_DATE',
          JSON.stringify({
            kind,
            today,
            input: item.input,
            status: response.status,
            businessDate: response.body.data?.businessDate,
            code: response.body.code,
            audit,
            databaseUnchanged: item.status === 422,
          }),
        );
      }
    } finally {
      await c.dispose();
    }
  });
for (const kind of ['inbound', 'outbound'] as const)
  test(`B5a ${kind}确认后直接改业务日期422`, async () => {
    const c = await correctionFixture(kind);
    try {
      const before = await businessFingerprint(c.db);
      const response = await c.web
        .patch(`${c.path}/business-date`)
        .set('origin', origin)
        .set('idempotency-key', randomUUID())
        .send({ businessDate: shifted(shanghaiToday(), -1) })
        .expect(422);
      assert.equal(response.body.code, 'BUSINESS_DATE_LOCKED');
      assert.deepEqual(await businessFingerprint(c.db), before);
      console.log(
        'B5A_DATE_LOCKED',
        JSON.stringify({ kind, status: response.status, code: response.body.code, databaseUnchanged: true }),
      );
    } finally {
      await c.dispose();
    }
  });
test('B5a 日期日历月与上海午夜边界', () => {
  assert.equal(backdateThreshold('2026-05-31'), '2026-02-28');
  assert.equal(backdateThreshold('2024-05-31'), '2024-02-29');
  assert.equal(shanghaiToday(new Date('2026-11-08T16:00:00Z')), '2026-11-09');
  console.log('B5A_DATE_BOUNDARY month_end=2026-02-28 leap=2024-02-29 Shanghai_midnight=2026-11-09');
});
