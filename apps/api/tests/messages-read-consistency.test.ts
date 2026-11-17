import test from 'node:test';
import assert from 'node:assert/strict';
import { identityFixture, identityOrigin as origin } from './identity-fixture.ts';
import { notificationFixture } from './messages-fixture.ts';
import { markRead } from '../src/features/notifications/mark-read.ts';
import { actor } from './fixture.ts';

test('B8c超过一页的稳定排序无重复，过滤总数与全局未读数独立', async () => {
  const c = await identityFixture();
  try {
    for (let i = 0; i < 51; i++) await notificationFixture(c.db);
    await notificationFixture(c.db, { type: 'anomaly' });
    const first = (await c.web.get('/api/v1/messages?type=pending&page=1').expect(200)).body.data;
    const second = (await c.web.get('/api/v1/messages?type=pending&page=2').expect(200)).body.data;
    assert.equal(first.total, 51);
    assert.equal(first.unreadCount, 52);
    assert.equal(first.items.length, 50);
    assert.equal(second.items.length, 1);
    assert.equal(new Set([...first.items, ...second.items].map((row) => row.id)).size, 51);
    const repeated = (await c.web.get('/api/v1/messages?type=pending&page=1').expect(200)).body.data;
    assert.deepEqual(repeated, first);
    await c.web.post('/api/v1/messages/read-all').set('Origin', origin).send({}).expect(200);
    await c.web.post('/api/v1/messages/read-all').set('Origin', origin).send({}).expect(200);
    assert.equal(
      Number((await c.db.get("SELECT COUNT(*) AS n FROM operation_log WHERE action='message.read_all'"))?.n),
      1,
    );
  } finally {
    await c.dispose();
  }
});

test('B8c并发已读只记一次审计，审计失败不留下半完成已读', async () => {
  const c = await identityFixture();
  try {
    const id = await notificationFixture(c.db);
    await Promise.all([markRead(c.db, actor, id), markRead(c.db, actor, id)]);
    assert.equal(Number((await c.db.get("SELECT COUNT(*) AS n FROM operation_log WHERE action='message.read'"))?.n), 1);
    const other = await notificationFixture(c.db);
    await c.db.run(
      "CREATE TRIGGER b8c_read_fail BEFORE INSERT ON operation_log FOR EACH ROW SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='B8c read failure'",
    );
    await assert.rejects(markRead(c.db, actor, other), /B8c read failure/);
    assert.equal((await c.db.get('SELECT read_at FROM notifications WHERE id=?', [other]))?.read_at, null);
  } finally {
    await c.dispose();
  }
});
