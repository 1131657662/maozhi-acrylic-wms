import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { numberingFixture, newReceipt, newPlan, origin } from './numbering-fixture.ts';
import { actor } from './fixture.ts';
import { createInbound } from '../src/features/inbound/create.ts';
import { createOutboundPlan } from '../src/features/outbound/plans.ts';

test('每类 50 个并发 HTTP 创建均唯一，幂等重放不消耗额外单号', async () => {
  const { db, web, dispose } = await numberingFixture();
  try {
    for (const kind of ['inbound', 'outbound'] as const) {
      const keys = Array.from({ length: 50 }, () => randomUUID());
      const payload = kind === 'inbound' ? newReceipt() : newPlan();
      const responses = await Promise.all(
        keys.map((key) =>
          web.post(`/api/v1/${kind}`).set('Origin', origin).set('Idempotency-Key', key).send(payload).expect(200),
        ),
      );
      const numbers = responses.map((response) =>
        String(response.body.data[kind === 'inbound' ? 'receiptNo' : 'orderNo']),
      );
      const duplicates = numbers.length - new Set(numbers).size;
      const replay = await web
        .post(`/api/v1/${kind}`)
        .set('Origin', origin)
        .set('Idempotency-Key', keys[0]!)
        .send(payload)
        .expect(200);
      assert.deepEqual(replay.body.data, responses[0]!.body.data);
      assert.equal(duplicates, 0);
      assert.equal(
        String(
          (await db.get('SELECT last_sequence FROM document_number_counters WHERE kind=?', [kind]))?.last_sequence,
        ),
        '50',
      );
      console.log(
        `B1A_CONCURRENCY ${JSON.stringify({ kind, requested: 50, succeeded: responses.length, unique: new Set(numbers).size, duplicates, replaySame: true, counter: 50 })}`,
      );
      console.log(`B1A_NUMBERS ${kind} ${JSON.stringify(numbers)}`);
    }
    assert.equal(Number((await db.get('SELECT COUNT(*) AS n FROM inbound_receipts'))?.n), 50);
    assert.equal(Number((await db.get('SELECT COUNT(*) AS n FROM outbound_orders'))?.n), 53);
    const inbound = await db.get('SELECT SUM(packages) AS packages,SUM(weight_tonnes) AS tonnes FROM inbound_lines');
    const stock = await db.get(
      "SELECT packages,weight_tonnes AS tonnes FROM stock WHERE warehouse_code='DEMO-WH' AND product_code='ACR-032' AND source_del_flag=0",
    );
    const journal = Number((await db.get('SELECT COUNT(*) AS n FROM stock_journal'))?.n);
    const audit = Number((await db.get("SELECT COUNT(*) AS n FROM operation_log WHERE action='inbound.confirm'"))?.n);
    assert.equal(Number(inbound?.packages), 50);
    assert.equal(inbound?.tonnes, '15.1250');
    assert.equal(stock?.packages, 6);
    assert.equal(stock?.tonnes, '1.8000');
    assert.equal(journal, 0);
    assert.equal(audit, 0);
    for (const [table, column] of [
      ['inbound_receipts', 'receipt_no'],
      ['outbound_orders', 'order_no'],
    ]) {
      assert.equal(
        (await db.all(`SELECT ${column},COUNT(*) AS n FROM ${table} GROUP BY ${column} HAVING COUNT(*)>1`)).length,
        0,
      );
    }
    console.log(
      `B1A_RECONCILIATION ${JSON.stringify({ inboundRows: 50, outboundRowsIncludingFixtures: 53, inbound, stock, journal, audit, duplicateGroups: 0 })}`,
    );
  } finally {
    await dispose();
  }
});

test('自动取号事务失败不消耗号，重试同键同正文只建一张单', async () => {
  const { db, dispose } = await numberingFixture();
  try {
    await assert.rejects(
      createInbound(
        db,
        { ...newReceipt(), lines: [{ productCode: 'MISSING-PRODUCT', packages: 1, weightGrams: 302500 }] },
        randomUUID(),
        actor,
      ),
    );
    assert.equal(Number((await db.get('SELECT COUNT(*) AS n FROM document_number_counters'))?.n), 0);
    assert.equal(Number((await db.get('SELECT COUNT(*) AS n FROM inbound_receipts'))?.n), 0);
    assert.equal(Number((await db.get('SELECT COUNT(*) AS n FROM stock_journal'))?.n), 0);
    const key = randomUUID();
    const rows = await Promise.all(Array.from({ length: 10 }, () => createOutboundPlan(db, newPlan(), key, actor)));
    assert.equal(new Set(rows.map((row) => row.id)).size, 1);
    assert.match(rows[0]!.orderNo, /^CK-\d{8}-0001$/);
    assert.equal(
      Number((await db.get("SELECT COUNT(*) AS n FROM operation_log WHERE action='outbound.plan.create'"))?.n),
      1,
    );
  } finally {
    await dispose();
  }
});
