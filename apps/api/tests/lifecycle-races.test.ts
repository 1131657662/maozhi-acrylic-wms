import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { fixture, actor } from './fixture.ts';
import { numberingFixture, newReceipt, newPlan, origin } from './numbering-fixture.ts';
import { prepared, commandFor, businessFingerprint } from './lifecycle-fixture.ts';
import { createInbound } from '../src/features/inbound/create.ts';
import { confirmInbound } from '../src/features/inbound/confirm.ts';
import { createOutboundPlan } from '../src/features/outbound/plans.ts';
import { executeLifecycle } from '../src/features/document-lifecycle/execute.ts';
import { lifecyclePreview } from '../src/features/document-lifecycle/preview.ts';

test('B2a 两商品第二笔补偿写入失败，第一笔及所有状态回滚', async () => {
  const { db, dispose } = await fixture();
  try {
    assert.match(String((await db.get('SELECT DATABASE() AS name'))?.name), /^maozhi_test_[a-f0-9]{24}$/);
    await db.run(`INSERT INTO master_products(code,name,active,source_kind,created_at,updated_at,origin_kind,inventory_eligible)
      VALUES('Z-MULTI','隔离多行验收',1,'erp-product',UTC_TIMESTAMP(3),UTC_TIMESTAMP(3),'legacy',1)`);
    const input = newReceipt();
    input.lines.push({ productCode: 'Z-MULTI', packages: 2, weightGrams: 601100 });
    const doc = await createInbound(db, input, randomUUID(), actor);
    await confirmInbound(db, doc.id, randomUUID(), actor);
    const command = await commandFor(db, { kind: 'inbound', id: doc.id }),
      before = await businessFingerprint(db);
    await db.run(`CREATE TRIGGER b2a_fail AFTER INSERT ON stock_journal FOR EACH ROW BEGIN
      IF NEW.product_code='Z-MULTI' THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='B2A second line failure'; END IF; END`);
    try {
      await assert.rejects(executeLifecycle(db, command), /second line failure/);
    } finally {
      await db.run('DROP TRIGGER b2a_fail');
    }
    assert.deepEqual(await businessFingerprint(db), before);
    const result = await executeLifecycle(db, command);
    assert.equal(result.status, 'cancelled');
    console.log(
      'B2A_MULTILINE second_product_failure=true first_product_rollback=true all_tables_unchanged=true same_key_recovery=success',
    );
  } finally {
    await dispose();
  }
});
test('B2a PDA读取与作废竞争：先读则阻断，先作废则PDA只收到终态', async () => {
  const { db, api, web, dispose } = await numberingFixture();
  try {
    const login = await api
      .post('/api/v1/auth/login')
      .send({ username: 'owner', password: 'test-only-password', channel: 'pda' });
    const results = [];
    for (let index = 0; index < 10; index++) {
      const plan = await createOutboundPlan(db, newPlan(), randomUUID(), actor),
        target = { kind: 'outbound' as const, id: plan.id };
      const command = await commandFor(db, target, 'void');
      const read = () =>
        api.get(`/api/v1/scan/plans/${plan.id}`).set('Authorization', `Bearer ${login.body.data.token}`);
      const close = () =>
        web
          .post(`/api/v1/outbound/${plan.id}/void`)
          .set('Origin', origin)
          .set('Idempotency-Key', command.key)
          .send(command.input);
      const responses = await Promise.all(index % 2 ? [read(), close()] : [close(), read()]);
      const [downloaded, closed] = index % 2 ? responses : [...responses].reverse();
      assert.equal(downloaded!.status, 200);
      if (closed!.status === 200) assert.equal(downloaded!.body.data.status, 'voided');
      else {
        assert.equal(closed!.status, 409);
        assert.equal(closed!.body.code, 'PDA_EXPOSURE');
      }
      results.push({ read: downloaded!.body.data.status, close: closed!.status });
    }
    console.log(`B2A_DISPATCH_RACE ${JSON.stringify(results)} open_download_and_successful_void=0`);
  } finally {
    await dispose();
  }
});
test('B2a 预览过期/原流水缺失均不写库', async () => {
  const { db, dispose } = await fixture();
  try {
    const target = await prepared(db, 'inbound'),
      command = await commandFor(db, target);
    await db.run('UPDATE inbound_receipts SET memo=? WHERE id=?', ['隔离预览变更', target.id]);
    const before = await businessFingerprint(db);
    await assert.rejects(executeLifecycle(db, command), { code: 'STALE_LIFECYCLE' });
    assert.deepEqual(await businessFingerprint(db), before);
    await db.run('UPDATE stock_journal SET source_del_flag=1 WHERE inbound_receipt_id=?', [target.id]);
    const missing = await businessFingerprint(db),
      preview = await lifecyclePreview(db, target);
    assert.equal(preview.allowed, false);
    await assert.rejects(executeLifecycle(db, command), { code: 'ORIGINAL_EVIDENCE_MISSING' });
    assert.deepEqual(await businessFingerprint(db), missing);
    console.log('B2A_PROOF stale_preview=409 missing_original=409 database_unchanged=true');
  } finally {
    await dispose();
  }
});
