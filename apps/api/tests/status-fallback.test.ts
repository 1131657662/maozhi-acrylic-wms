import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { numberingFixture, newReceipt, origin } from './numbering-fixture.ts';
import { actor } from './fixture.ts';
import { createInbound } from '../src/features/inbound/create.ts';
import { confirmInbound } from '../src/features/inbound/confirm.ts';

test('未知单据状态和流水类型通过真实 HTTP 原样返回，软删流水排除', async () => {
  const { db, web, dispose } = await numberingFixture();
  try {
    const receipt = await createInbound(db, newReceipt(), randomUUID(), actor);
    await confirmInbound(db, receipt.id, randomUUID(), actor);
    await db.run("UPDATE inbound_receipts SET status='future_inbound_state' WHERE id=?", [receipt.id]);
    await db.run("UPDATE outbound_orders SET status='constructor' WHERE id='DEMO-001'");
    await db.run("UPDATE stock_journal SET source_business_type='future_journal_type' WHERE inbound_receipt_id=?", [
      receipt.id,
    ]);
    assert.equal((await web.get(`/api/v1/inbound/${receipt.id}`).expect(200)).body.data.status, 'future_inbound_state');
    assert.equal((await web.get('/api/v1/inbound').expect(200)).body.data.items[0].status, 'future_inbound_state');
    assert.equal((await web.get('/api/v1/outbound/DEMO-001').expect(200)).body.data.status, 'constructor');
    assert.equal((await web.get('/api/v1/stock/journal').expect(200)).body.data[0].type, 'future_journal_type');
    await db.run(
      "UPDATE stock_journal SET source_id='TEST-SOURCE',source_business_type=NULL WHERE inbound_receipt_id=?",
      [receipt.id],
    );
    assert.equal((await web.get('/api/v1/stock/journal').expect(200)).body.data[0].type, null);
    await db.run('UPDATE stock_journal SET source_del_flag=1 WHERE inbound_receipt_id=?', [receipt.id]);
    assert.equal((await web.get('/api/v1/stock/journal').expect(200)).body.data.length, 0);
  } finally {
    await dispose();
  }
});

test('编号/流水入口保持登录、Web 会话、同源与请求校验边界', async () => {
  const { api, web, dispose } = await numberingFixture();
  try {
    await api.get('/api/v1/document-numbering').expect(401);
    await api.get('/api/v1/stock/journal').expect(401);
    for (const channel of ['pda', 'miniapp']) {
      const auth = await api
        .post('/api/v1/auth/login')
        .send({ username: 'owner', password: 'test-only-password', channel })
        .expect(200);
      await api.get('/api/v1/document-numbering').auth(auth.body.data.token, { type: 'bearer' }).expect(403);
      await api.get('/api/v1/stock/journal').auth(auth.body.data.token, { type: 'bearer' }).expect(403);
      await api
        .put('/api/v1/document-numbering/inbound')
        .auth(auth.body.data.token, { type: 'bearer' })
        .send({})
        .expect(403);
    }
    await web.put('/api/v1/document-numbering/inbound').send({ width: 4, expectedVersion: 0 }).expect(403);
    await web
      .put('/api/v1/document-numbering/inbound')
      .set('Origin', origin)
      .set('Idempotency-Key', randomUUID())
      .send({ width: 1, expectedVersion: 0 })
      .expect(422);
    await web.get('/api/v1/stock/journal?limit=101').expect(422);
  } finally {
    await dispose();
  }
});
