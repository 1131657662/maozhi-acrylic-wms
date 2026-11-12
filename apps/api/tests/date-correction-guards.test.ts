import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { shanghaiToday } from '@wms/contracts';
import { dateFixture, dateInput, rejectDate } from './date-correction-fixture.ts';
import { newPlan, newReceipt, origin } from './numbering-fixture.ts';
import { businessFingerprint } from './lifecycle-fixture.ts';

for (const kind of ['inbound', 'outbound'] as const)
  test(`B5d-1 ${kind} pending routes to 011, void/reverse reject and audited NULL is immutable`, async () => {
    const c = await dateFixture(kind);
    try {
      const pending = (
        await c.web
          .post(`/api/v1/${kind}`)
          .set('origin', origin)
          .set('idempotency-key', randomUUID())
          .send(kind === 'inbound' ? newReceipt() : newPlan())
          .expect(200)
      ).body.data;
      const path = `/api/v1/${kind}/${pending.id}`;
      const send = (action: string, body: object) =>
        c.web.post(`${path}/${action}`).set('origin', origin).set('idempotency-key', randomUUID()).send(body);
      let before = await businessFingerprint(c.db);
      const rejected = await send('date-corrections', dateInput()).expect(422);
      assert.match(rejected.body.message, /未入账业务日期修改/);
      assert.deepEqual(await businessFingerprint(c.db), before);
      const preview = (await c.web.get(`${path}/lifecycle`).expect(200)).body.data;
      await send('void', { reason: '作废合成单据', expectedToken: preview.token }).expect(200);
      before = await businessFingerprint(c.db);
      await send('date-corrections', dateInput()).expect(422);
      assert.deepEqual(await businessFingerprint(c.db), before);
      const reverse = (await c.web.get(`${c.path}/lifecycle`).expect(200)).body.data;
      await c.web
        .post(`${c.path}/reverse`)
        .set('origin', origin)
        .set('idempotency-key', randomUUID())
        .send({ reason: '撤销合成已入账单', expectedToken: reverse.token })
        .expect(200);
      await rejectDate(c, dateInput(), 422);
      // Reproduce the read-only audited source record in this disposable test DB, never the sample database.
      await c.db.run(
        `UPDATE ${c.table} SET business_date=NULL,source_id='B5D1-NULL-AUDITED',status='audited' WHERE id=?`,
        [pending.id],
      );
      const old = await c.db.get(`SELECT * FROM ${c.table} WHERE business_date IS NULL AND status='audited' AND id=?`, [
        pending.id,
      ]);
      assert.ok(old);
      before = await businessFingerprint(c.db);
      const missing = await send('date-corrections', dateInput(shanghaiToday())).expect(422);
      assert.equal(missing.body.message, '该单无原始业务日期（历史单据），不支持日期更正');
      assert.deepEqual(await businessFingerprint(c.db), before);
      console.log(`B5D1_NULL kind=${kind} status=audited null_date=422 all_tables_unchanged=true`);
    } finally {
      await c.dispose();
    }
  });
