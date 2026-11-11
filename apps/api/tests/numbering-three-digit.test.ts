import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { numberingFixture, newReceipt, newPlan, origin } from './numbering-fixture.ts';
import { businessTableFingerprints } from './lifecycle-fixture.ts';
import { createInbound } from '../src/features/inbound/create.ts';
import { actor } from './fixture.ts';

test('三位入出库按业务日001/002，跨日001；旧四位可查询读取', async () => {
  const c = await numberingFixture();
  try {
    for (const [kind, field, prefix, input] of [
      ['inbound', 'receiptNo', 'RK', newReceipt()],
      ['outbound', 'orderNo', 'CK', newPlan()],
    ] as const) {
      const numbers: string[] = [];
      for (const day of ['2026-01-02', '2026-01-02', '2026-01-03']) {
        const created = await c.web
          .post(`/api/v1/${kind}`)
          .set('Origin', origin)
          .set('Idempotency-Key', randomUUID())
          .send({ ...input, businessDate: day, backdateConfirmed: true })
          .expect(200);
        numbers.push(created.body.data[field]);
      }
      assert.deepEqual(numbers, [`${prefix}-20260102-001`, `${prefix}-20260102-002`, `${prefix}-20260103-001`]);
      console.log('B6A_NUM_DOCUMENTS', JSON.stringify({ kind, numbers }));
    }
    const old = await createInbound(c.db, { ...newReceipt(), receiptNo: 'RK-20260104-0088' }, randomUUID(), actor);
    const read = await c.web.get(`/api/v1/inbound/${old.id}`).expect(200);
    const list = await c.web.get('/api/v1/web/lists/inbound').query({ keyword: old.receiptNo }).expect(200);
    assert.equal(read.body.data.receiptNo, old.receiptNo);
    assert.equal(list.body.data.total, 1);
    console.log(
      'B6A_NUM_LEGACY',
      JSON.stringify({ number: old.receiptNo, listCount: list.body.data.total, detailStatus: read.status }),
    );
  } finally {
    await c.dispose();
  }
});

test('单日第1000单拒绝，计数器/单据/库存/审计/幂等全库不变', async () => {
  const c = await numberingFixture();
  try {
    for (const [kind, input] of [
      ['inbound', newReceipt()],
      ['outbound', newPlan()],
    ] as const) {
      await c.db.run('INSERT INTO document_number_rules(kind) VALUES(?)', [kind]);
      await c.db.run('INSERT INTO document_number_counters(kind,date_key,last_sequence) VALUES(?,?,999)', [
        kind,
        '20260102',
      ]);
      const before = await businessTableFingerprints(c.db);
      const result = await c.web
        .post(`/api/v1/${kind}`)
        .set('Origin', origin)
        .set('Idempotency-Key', randomUUID())
        .send({ ...input, businessDate: '2026-01-02', backdateConfirmed: true })
        .expect(422);
      assert.equal(result.body.code, 'NUMBER_SEQUENCE_EXHAUSTED');
      assert.deepEqual(await businessTableFingerprints(c.db), before);
      console.log(
        'B6A_NUM_1000',
        JSON.stringify({
          kind,
          status: result.status,
          message: result.body.message,
          databaseUnchanged: true,
          counter: 999,
          produced1000: false,
        }),
      );
    }
  } finally {
    await c.dispose();
  }
});
