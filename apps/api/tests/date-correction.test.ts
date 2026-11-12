import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { shanghaiToday, backdateThreshold } from '@wms/contracts';
import { dateFixture, dateInput, shiftedDate, rejectDate } from './date-correction-fixture.ts';
import { businessFingerprint, injectLifecycleFailure } from './lifecycle-fixture.ts';

for (const kind of ['inbound', 'outbound'] as const) {
  test(`B5d-1 ${kind} append-only chain, replay, concurrency and effective read models`, async () => {
    const c = await dateFixture(kind);
    try {
      const original = await c.db.get(`SELECT * FROM ${c.table} WHERE id=?`, [c.target.id]);
      const journal = await c.db.all('SELECT * FROM stock_journal ORDER BY id');
      const stock = await c.db.all('SELECT * FROM stock ORDER BY warehouse_code,product_code');
      const operations = await c.db.all('SELECT * FROM inventory_operations ORDER BY id');
      const previousMonth = shiftedDate(`${shanghaiToday().slice(0, 7)}-01`, -1);
      const query = { source: 'erp-product', fromDay: previousMonth, toDay: shanghaiToday(), product: 'ACR-032' };
      const reports = async () =>
        Promise.all(
          ['details', 'monthly'].map(async (report) => {
            const data = (await c.web.get(`/api/v1/web/reports/${report}`).query(query).expect(200)).body.data;
            return { items: data.items, total: data.total, report: data.report };
          }),
        );
      const beforeReports = await reports();
      const firstInput = dateInput(previousMonth),
        key = randomUUID();
      const first = (await c.send(firstInput, key).expect(200)).body.data;
      assert.deepEqual(await reports(), beforeReports);
      const fingerprint = await businessFingerprint(c.db);
      assert.deepEqual((await c.send(firstInput, key).expect(200)).body.data, first);
      assert.deepEqual(await businessFingerprint(c.db), fingerprint);
      await c.send({ ...firstInput, reason: '不同正文' }, key).expect(409);
      await rejectDate(c, dateInput(), 409);
      const secondInput = dateInput(shiftedDate(shanghaiToday(), -2), 1);
      const concurrent = await Promise.all([c.send(secondInput), c.send(secondInput)]);
      assert.deepEqual(concurrent.map((r) => r.status).sort(), [200, 409]);
      const history = await c.history();
      assert.equal(history.revision, 2);
      assert.equal(history.records[1]!.beforeDate, first.afterDate);
      assert.equal(history.records[1]!.previousCorrectionId, first.id);
      assert.equal(history.effectiveBusinessDate, secondInput.afterDate);
      const detail = (await c.detail()).body.data;
      assert.equal(detail.businessDate, original?.business_date);
      assert.equal(detail.effectiveBusinessDate, secondInput.afterDate);
      const number = kind === 'inbound' ? detail.receiptNo : detail.orderNo;
      const list = (await c.web.get(`/api/v1/web/lists/${kind}`).query({ keyword: number }).expect(200)).body.data;
      assert.equal(list.items[0].effectiveBusinessDate, secondInput.afterDate);
      assert.deepEqual(await c.db.get(`SELECT * FROM ${c.table} WHERE id=?`, [c.target.id]), original);
      assert.deepEqual(await c.db.all('SELECT * FROM stock_journal ORDER BY id'), journal);
      assert.deepEqual(await c.db.all('SELECT * FROM stock ORDER BY warehouse_code,product_code'), stock);
      assert.deepEqual(await c.db.all('SELECT * FROM inventory_operations ORDER BY id'), operations);
      assert.deepEqual(await reports(), beforeReports);
      assert.equal(
        (await c.db.all('SELECT id FROM operation_log WHERE action=?', [`date-correction.${kind}`])).length,
        2,
      );
      console.log(
        `B5D1_CHAIN kind=${kind} revisions=2 replay=once concurrent=200/409 original_stock_journal_unchanged=true`,
      );
    } finally {
      await c.dispose();
    }
  });
  test(`B5d-1 ${kind} future, calendar-month acknowledgement, closed and historical guards`, async () => {
    const c = await dateFixture(kind);
    try {
      const today = shanghaiToday(),
        old = shiftedDate(backdateThreshold(today), -1);
      await rejectDate(c, dateInput(shiftedDate(today, 1)), 422);
      await rejectDate(c, dateInput(old), 422);
      await rejectDate(c, { ...dateInput(), reason: '   ' }, 422);
      await rejectDate(c, { ...dateInput(), businessDate: today }, 422);
      await c.send({ ...dateInput(old), backdateConfirmed: true }).expect(200);
      const audit = await c.db.get('SELECT after_json FROM operation_log WHERE action=?', [`date-correction.${kind}`]);
      assert.equal(JSON.parse(String(audit?.after_json)).businessDateConfirmation.backdateConfirmed, true);
      await c.db.run(`UPDATE ${c.table} SET source_id='B5D1-HISTORY' WHERE id=?`, [c.target.id]);
      await rejectDate(c, dateInput(today, 1), 422);
      await c.db.run(`UPDATE ${c.table} SET source_id=NULL,status='cancelled' WHERE id=?`, [c.target.id]);
      await rejectDate(c, dateInput(today, 1), 422);
      console.log(
        `B5D1_GUARDS kind=${kind} future=422 old_unconfirmed=422 old_confirmed=200 historical=422 cancelled=422`,
      );
    } finally {
      await c.dispose();
    }
  });
}
test('B5d-1 audit failure rolls back date chain and command; original key retries once', async () => {
  const c = await dateFixture();
  try {
    const input = dateInput(shiftedDate(shanghaiToday(), -1)),
      key = randomUUID();
    await injectLifecycleFailure(c.db, 'operation_log', 'INSERT');
    const before = await businessFingerprint(c.db);
    await c.send(input, key).expect(500);
    assert.deepEqual(await businessFingerprint(c.db), before);
    await c.db.run('DROP TRIGGER b2a_fail');
    await c.send(input, key).expect(200);
    await c.send(input, key).expect(200);
    assert.equal((await c.history()).records.length, 1);
  } finally {
    await c.dispose();
  }
});
