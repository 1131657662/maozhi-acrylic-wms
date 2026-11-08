import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { numberingFixture, newPlan, newReceipt, origin } from './numbering-fixture.ts';
import { actor } from './fixture.ts';
import { createInbound } from '../src/features/inbound/create.ts';
import { createOutboundPlan, editOutboundPlan } from '../src/features/outbound/plans.ts';
import { businessDate } from '../src/features/document-numbering/repository.ts';
import { listNumbering, updateNumbering } from '../src/features/document-numbering/service.ts';

test('首次启用扫描完整历史格式及软删号，保留无法解析的号；北京时间日界线正确', async () => {
  const { db, dispose } = await numberingFixture();
  try {
    const date = businessDate();
    const old = await createInbound(db, { ...newReceipt(), receiptNo: `RK-${date}-0088` }, randomUUID(), actor);
    await db.run('UPDATE inbound_receipts SET source_del_flag=1 WHERE id=?', [old.id]);
    await createInbound(db, { ...newReceipt(), receiptNo: `RK-${date}-invalid-9999` }, randomUUID(), actor);
    const before = await listNumbering(db);
    assert.equal(before[0]!.preview, `RK-${date}-0089`);
    assert.equal(Number((await db.get('SELECT COUNT(*) AS n FROM document_number_rules'))?.n), 0);
    const current = await createInbound(db, newReceipt(), randomUUID(), actor);
    assert.equal(current.receiptNo, before[0]!.preview);
    assert.equal(Number((await db.get('SELECT COUNT(*) AS n FROM inbound_receipts'))?.n), 3);
    assert.equal(businessDate(new Date('2026-11-08T15:59:59Z')), '20261108');
    assert.equal(businessDate(new Date('2026-11-08T16:00:00Z')), '20261109');
  } finally {
    await dispose();
  }
});

test('调窄宽度撞历史号返回明确 409，原配置/计数器/单据保持不变', async () => {
  const { db, web, dispose } = await numberingFixture();
  try {
    await createOutboundPlan(db, newPlan(), randomUUID(), actor);
    const collision = `CK-${businessDate()}-02`;
    const legacy = await createOutboundPlan(db, { ...newPlan(), orderNo: collision }, randomUUID(), actor);
    await db.run('UPDATE outbound_orders SET source_del_flag=1 WHERE id=?', [legacy.id]);
    const before = Number((await db.get('SELECT COUNT(*) AS n FROM outbound_orders'))?.n);
    const result = await web
      .put('/api/v1/document-numbering/outbound')
      .set('Origin', origin)
      .set('Idempotency-Key', randomUUID())
      .send({ width: 2, expectedVersion: 0 })
      .expect(409);
    const after = Number((await db.get('SELECT COUNT(*) AS n FROM outbound_orders'))?.n);
    const duplicates = await db.all(
      'SELECT order_no,COUNT(*) AS n FROM outbound_orders GROUP BY order_no HAVING COUNT(*)>1',
    );
    assert.equal(result.body.code, 'NUMBERING_COLLISION');
    assert.match(result.body.message, /原配置未改变/);
    assert.equal(before, after);
    assert.equal(duplicates.length, 0);
    assert.equal((await listNumbering(db))[1]!.width, 4);
    assert.equal(
      String((await db.get("SELECT last_sequence FROM document_number_counters WHERE kind='outbound'"))?.last_sequence),
      '1',
    );
    console.log(
      `B1A_WIDTH_COLLISION ${JSON.stringify({ httpStatus: result.status, response: result.body, beforeRows: before, afterRows: after, newRows: after - before, duplicateGroups: duplicates.length, width: 4, counter: 1 })}`,
    );
  } finally {
    await dispose();
  }
});

test('兼容旧单号和旧幂等结果，编辑只能回传原号；不静默替换重复号', async () => {
  const { db, web, dispose } = await numberingFixture();
  try {
    for (const [path, field, body] of [
      ['inbound', 'receiptNo', newReceipt()],
      ['outbound', 'orderNo', newPlan()],
    ] as const) {
      const key = randomUUID();
      const input = { ...body, [field]: `LEGACY-${path}` };
      const post = () => web.post(`/api/v1/${path}`).set('Origin', origin).set('Idempotency-Key', key).send(input);
      const first = await post().expect(200);
      assert.equal(first.headers['x-document-number-mode'], 'legacy-preserved');
      assert.ok(first.headers.deprecation);
      assert.equal(first.body.data[field], `LEGACY-${path}`);
      if (path === 'inbound') {
        await db.run(
          "UPDATE idempotent_commands SET result_json=JSON_REMOVE(result_json,'$.status','$.postingState','$.confirmationOperationId') WHERE command_key=?",
          [`inbound.create:owner:${key}`],
        );
      }
      assert.deepEqual(
        (await post().expect(200)).body.data,
        path === 'inbound'
          ? { ...first.body.data, status: null, postingState: 'legacy', confirmationOperationId: null }
          : first.body.data,
      );
      const duplicate = await web
        .post(`/api/v1/${path}`)
        .set('Origin', origin)
        .set('Idempotency-Key', randomUUID())
        .send(input)
        .expect(409);
      assert.equal(duplicate.body.code, path === 'inbound' ? 'RECEIPT_NO_EXISTS' : 'DUPLICATE_ORDER_NO');
    }
    const plan = await createOutboundPlan(db, newPlan(), randomUUID(), actor);
    await assert.rejects(
      editOutboundPlan(
        db,
        plan.id,
        { revision: plan.revision, digest: plan.digest, plan: { ...newPlan(), orderNo: 'CHANGED-NUMBER' } },
        randomUUID(),
        actor,
      ),
      { code: 'DOCUMENT_NUMBER_IMMUTABLE' },
    );
    const edited = await editOutboundPlan(
      db,
      plan.id,
      {
        revision: plan.revision,
        digest: plan.digest,
        plan: { ...newPlan(), orderNo: plan.orderNo, vehicleNo: 'LEGACY-EDIT' },
      },
      randomUUID(),
      actor,
    );
    assert.equal(edited.orderNo, plan.orderNo);
  } finally {
    await dispose();
  }
});

test('宽度修改幂等且不重置序号，过期配置/超限号 fail closed', async () => {
  const { db, dispose } = await numberingFixture();
  try {
    const first = await createOutboundPlan(db, newPlan(), randomUUID(), actor);
    const key = randomUUID();
    const change = { width: 5, expectedVersion: 0 };
    const saved = await updateNumbering(db, 'outbound', change, key, actor);
    assert.deepEqual(await updateNumbering(db, 'outbound', change, key, actor), saved);
    const next = await createOutboundPlan(db, newPlan(), randomUUID(), actor);
    assert.match(first.orderNo, /-0001$/);
    assert.match(next.orderNo, /-00002$/);
    await assert.rejects(updateNumbering(db, 'outbound', change, randomUUID(), actor), {
      code: 'NUMBERING_VERSION_CONFLICT',
    });
    await createInbound(
      db,
      { ...newReceipt(), receiptNo: `RK-${businessDate()}-99999999999999999` },
      randomUUID(),
      actor,
    );
    await assert.rejects(createInbound(db, newReceipt(), randomUUID(), actor), { code: 'NUMBER_SEQUENCE_EXHAUSTED' });
    assert.equal((await listNumbering(db))[0]!.preview, null);
    assert.equal(
      Number((await db.get("SELECT COUNT(*) AS n FROM operation_log WHERE action='numbering.update'"))?.n),
      1,
    );
  } finally {
    await dispose();
  }
});
