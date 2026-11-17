import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { identityFixture, identityOrigin as origin } from './identity-fixture.ts';
import { notificationFixture } from './messages-fixture.ts';

test('B8c列表过滤稳定分页与全局活动未读数，单条/全部已读幂等', async () => {
  const c = await identityFixture();
  try {
    const id = await notificationFixture(c.db);
    await notificationFixture(c.db, { type: 'anomaly', resolvedAt: '2026-11-17 01:00:00' });
    const page = (await c.web.get('/api/v1/messages?type=pending&unread=true&page=1').expect(200)).body.data;
    assert.equal(page.total, 1);
    assert.equal(page.unreadCount, 1);
    assert.equal(page.items[0].id, id);
    const first = await c.web.post(`/api/v1/messages/${id}/read`).set('Origin', origin).send({}).expect(200);
    assert.equal(first.body.data.unreadCount, 0);
    const at = (await c.db.get('SELECT read_at FROM notifications WHERE id=?', [id]))?.read_at;
    await c.web.post(`/api/v1/messages/${id}/read`).set('Origin', origin).send({}).expect(200);
    assert.equal((await c.db.get('SELECT read_at FROM notifications WHERE id=?', [id]))?.read_at, at);
    await notificationFixture(c.db);
    await c.web.post('/api/v1/messages/read-all').set('Origin', origin).send({}).expect(200);
    assert.equal((await c.web.get('/api/v1/messages/unread-count').expect(200)).body.data.unreadCount, 0);
    await c.web.post(`/api/v1/messages/${randomUUID()}/read`).set('Origin', origin).expect(404);
    assert.equal((await c.web.get('/api/v1/messages?unread=false')).body.data.total, 3);
    assert.equal(Number((await c.db.get("SELECT COUNT(*) AS n FROM operation_log WHERE action='message.read'"))?.n), 1);
  } finally {
    await c.dispose();
  }
});
test('B8c拒绝匿名、Bearer、移动端、跨源和非法参数', async () => {
  const c = await identityFixture();
  try {
    await c.api.get('/api/v1/messages').expect(401);
    await c.api.get('/api/v1/messages').auth(c.token, { type: 'bearer' }).expect(403);
    await c.web.post('/api/v1/messages/read-all').send({}).expect(403);
    await c.web.post('/api/v1/messages/read-all').set('Origin', 'https://invalid.example').send({}).expect(403);
    for (const query of ['type=unknown', 'unread=1', 'page=0', 'page=10001', 'owner=other'])
      await c.web.get(`/api/v1/messages?${query}`).expect(422);
    await c.web.post('/api/v1/messages/read-all').set('Origin', origin).send({ username: 'other' }).expect(422);
    const login = await c.api
      .post('/api/v1/auth/login')
      .send({ username: 'owner', password: 'test-only-password', channel: 'pda' });
    await c.api.get('/api/v1/messages/unread-count').auth(login.body.data.token, { type: 'bearer' }).expect(403);
  } finally {
    await c.dispose();
  }
});
