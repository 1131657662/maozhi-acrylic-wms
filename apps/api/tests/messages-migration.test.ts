import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { fixture } from './fixture.ts';
import { migrateDown, migrateUp } from '../src/db/migrate.ts';
import { notificationFixture } from './messages-fixture.ts';

test('029空表往返且两表非空均在DDL前拒绝down', async () => {
  const c = await fixture();
  try {
    await migrateDown(c.db);
    assert.equal(await c.db.get("SHOW TABLES LIKE 'notifications'"), undefined);
    await migrateUp(c.db);
    await c.db.run("INSERT INTO notification_scan_state VALUES('scan',UTC_TIMESTAMP(3),'succeeded','{}')");
    await assert.rejects(migrateDown(c.db), /notification_scan_state.*含有数据/);
    assert.ok(await c.db.get("SHOW TABLES LIKE 'notifications'"));
    await c.db.run('DELETE FROM notification_scan_state');
    await notificationFixture(c.db);
    await assert.rejects(migrateDown(c.db), /notifications.*含有数据/);
    assert.equal(
      (await c.db.get("SELECT state FROM schema_migrations WHERE id='029_notifications'"))?.state,
      'applied',
    );
  } finally {
    await c.dispose();
  }
});
test('029唯一活动键防重复，解除释放键但保留原通知', async () => {
  const c = await fixture();
  try {
    const id = await notificationFixture(c.db);
    const insert = `INSERT INTO notifications(id,type,object_type,object_id,event_key,cycle_anchor,title,body,link_path,
      created_at,expires_at) SELECT ?,type,object_type,object_id,event_key,'next',title,body,link_path,created_at,expires_at
      FROM notifications WHERE id=?`;
    await assert.rejects(c.db.run(insert, [randomUUID(), id]), /Duplicate/);
    await c.db.run('UPDATE notifications SET resolved_at=UTC_TIMESTAMP(3) WHERE id=?', [id]);
    await c.db.run(insert, [randomUUID(), id]);
    assert.equal(Number((await c.db.get('SELECT COUNT(*) AS n FROM notifications'))?.n), 2);
  } finally {
    await c.dispose();
  }
});
