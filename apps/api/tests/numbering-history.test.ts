import { businessTableFingerprints } from './lifecycle-fixture.ts';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { numberingFixture, newPlan, newReceipt, origin } from './numbering-fixture.ts';
import { actor } from './fixture.ts';
import { createInbound } from '../src/features/inbound/create.ts';
import { createOutboundPlan, editOutboundPlan } from '../src/features/outbound/plans.ts';
import { businessDate } from '../src/features/document-numbering/repository.ts';
import { listNumbering } from '../src/features/document-numbering/service.ts';

test('首次启用扫描完整历史格式及软删号，保留无法解析的号；北京时间日界线正确', async () => {
  const { db, dispose } = await numberingFixture();
  try {
    const date = businessDate();
    const old = await createInbound(db, { ...newReceipt(), receiptNo: `RK-${date}-0088` }, randomUUID(), actor);
    await db.run('UPDATE inbound_receipts SET source_del_flag=1 WHERE id=?', [old.id]);
    await createInbound(db, { ...newReceipt(), receiptNo: `RK-${date}-invalid-9999` }, randomUUID(), actor);
    const before = await listNumbering(db);
    assert.equal(before[0]!.preview, `RK-${date}-089`);
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

test('编号规则只读，修改返回 422 且全库不变', async () => {
  const { db, web, dispose } = await numberingFixture();
  try {
    await createOutboundPlan(db, newPlan(), randomUUID(), actor);
    const before = await businessTableFingerprints(db);
    for (const width of [2, 3, 4, 8]) {
      const result = await web
        .put('/api/v1/document-numbering/outbound')
        .set('Origin', origin)
        .set('Idempotency-Key', randomUUID())
        .send({ width, expectedVersion: 0 })
        .expect(422);
      assert.equal(result.body.code, 'NUMBERING_READ_ONLY');
    }
    assert.deepEqual(await businessTableFingerprints(db), before);
    assert.equal((await listNumbering(db))[1]!.width, 3);
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

test('历史超限序号 fail closed，不重置或自动扩位', async () => {
  const { db, dispose } = await numberingFixture();
  try {
    await createInbound(
      db,
      { ...newReceipt(), receiptNo: `RK-${businessDate()}-99999999999999999` },
      randomUUID(),
      actor,
    );
    await assert.rejects(createInbound(db, newReceipt(), randomUUID(), actor), { code: 'NUMBER_SEQUENCE_EXHAUSTED' });
    assert.equal((await listNumbering(db))[0]!.preview, null);
  } finally {
    await dispose();
  }
});
