import { test } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { fixture, actor } from './fixture.ts';
import { handoffPlan, handoffLine, prepareHandoff } from './handoff-fixture.ts';
import { startHandoff } from '../src/features/handoff/start.ts';
import { registerRecords } from '../src/features/handoff/records.ts';
import { handoffDetail, handoffOverview } from '../src/features/handoff/read.ts';
import { bindRecords } from '../src/features/handoff/bind.ts';
import { confirmHandoff } from '../src/features/handoff/confirm.ts';
import { publicationGate, noteLegacyClient } from '../src/features/catalog/gate.ts';
import { recordFact } from '../src/features/scan/service.ts';
import { hash } from '../src/shared/hash.ts';
import { scanContextInputSchema } from '@wms/contracts';
import { assertHandoffReady } from '../src/db/handoff-readiness.ts';
import { migrateDown, migrateUp } from '../src/db/migrate.ts';
import { createTestDatabase } from '../../../scripts/mysql/test-database.ts';

test('B1c2 60条交接批量绑定、丢响应核验、幂等重传、旧请求重新阻断', async () => {
  const { db, dispose } = await fixture();
  try {
    const { header, records, facts } = await prepareHandoff(db);
    await startHandoff(db, header, actor);
    const before = await db.all('SELECT * FROM scan_facts ORDER BY id');
    for (let i = 0; i < records.length; i += 3)
      await registerRecords(
        db,
        header.id,
        records.slice(i, i + 3).map((r) => ({
          planId: handoffPlan,
          rawPayload: r.payload,
          payloadSha: hash(r.payload),
          localState: r.state as 'pending' | 'failed',
        })),
      );
    const initial = await handoffDetail(db, header.id);
    assert.equal(initial.summary.received, 2);
    assert.equal(initial.summary.missingContext, 58);
    assert.equal(initial.summary.manifestValid, true);
    await assert.rejects(confirmHandoff(db, header.id, actor), /58 条/);
    await assert.rejects(bindRecords(db, header.id, [facts[0]!.id], 'DEMO-001-L1', actor), /原单内/);
    await bindRecords(
      db,
      header.id,
      initial.items.filter((r) => !r.context).map((r) => r.factId),
      handoffLine,
      actor,
    );
    await bindRecords(
      db,
      header.id,
      initial.items.filter((r) => !r.context).map((r) => r.factId),
      handoffLine,
      actor,
    );
    for (const fact of facts) {
      const row = await db.get('SELECT context_json FROM pda_handoff_records WHERE handoff_id=? AND fact_id=?', [
        header.id,
        fact.id,
      ]);
      const context = scanContextInputSchema.parse(JSON.parse(String(row!.context_json)));
      await recordFact(db, { planId: handoffPlan, fact, context, actor });
      await recordFact(db, { planId: handoffPlan, fact, context, actor });
    }
    assert.deepEqual(
      (await db.all('SELECT * FROM scan_facts ORDER BY id')).filter((r) => before.some((x) => x.id === r.id)),
      before,
    );
    assert.equal((await handoffDetail(db, header.id)).summary.received, 60);
    await confirmHandoff(db, header.id, actor);
    await confirmHandoff(db, header.id, actor);
    const r = records[0]!;
    const replay = {
      planId: handoffPlan,
      rawPayload: r.payload,
      payloadSha: hash(r.payload),
      localState: 'pending' as const,
    };
    await registerRecords(db, header.id, [replay]);
    await assert.rejects(
      registerRecords(db, header.id, [
        { ...replay, context: { outboundLineId: 'other', sourceSpec: null, resolvedAt: null } },
      ]),
      /不可覆盖/,
    );
    assert.equal((await handoffDetail(db, header.id)).summary.registered, 60);
    console.log('B1C2_HANDOFF sealed_replay=accepted changed_context=refused registered=60');
    assert.equal((await publicationGate(db, true)).allowed, true);
    await noteLegacyClient(db, `device:${header.deviceId}`);
    assert.equal((await publicationGate(db, true)).allowed, false);
    assert.equal((await handoffOverview(db)).clients.length, 1);
    await assert.rejects(migrateDown(db), (error: Error) => {
      console.log('B1C2_DOWN_ACTUAL', error.message);
      return /含有数据/.test(error.message);
    });
    console.log(
      'B1C2_HANDOFF pending=55 failed=5 lost_response_confirmed=2 manifest=60/60 batch_binding=58/58 received=60/60 duplicates=0 old_protocol_reblocks=true down_nonempty=refused',
    );
  } finally {
    await dispose();
  }
});
test('B1c2 007空表down/up；清单写入中途失败整批回滚；PDA不能确认交接或出库', async () => {
  const empty = await createTestDatabase();
  try {
    await assertHandoffReady(empty.db);
    await migrateDown(empty.db);
    await assert.rejects(assertHandoffReady(empty.db), /拒绝启动写服务/);
    await migrateUp(empty.db);
    await assertHandoffReady(empty.db);
    console.log('B1C2_MIGRATION 007 empty_down_up=success');
  } finally {
    await empty.dispose();
  }
  const { db, app, dispose } = await fixture();
  try {
    const { header, records } = await prepareHandoff(db);
    await startHandoff(db, header, actor);
    await assert.rejects(
      registerRecords(
        db,
        header.id,
        records
          .slice(0, 2)
          .map((r, i) => ({
            planId: handoffPlan,
            rawPayload: r.payload,
            payloadSha: i === 0 ? hash(r.payload) : '0'.repeat(64),
            localState: 'pending',
          })),
      ),
      /摘要不符/,
    );
    assert.equal((await handoffDetail(db, header.id)).summary.registered, 0);
    for (const channel of ['pda', 'miniapp']) {
      const login = await request(app)
        .post('/api/v1/auth/login')
        .send({ username: 'owner', password: 'test-only-password', channel });
      for (const endpoint of [
        `/catalog/handoffs/${header.id}/confirm`,
        '/stock/adjustments',
        `/outbound/${handoffPlan}/confirm`,
      ])
        await request(app)
          .post(`/api/v1${endpoint}`)
          .auth(login.body.data.token, { type: 'bearer' })
          .send({})
          .expect(403);
    }
    console.log('B1C2_HANDOFF rollback_registered=0 pda_miniapp_confirm_adjust=403');
  } finally {
    await dispose();
  }
});
