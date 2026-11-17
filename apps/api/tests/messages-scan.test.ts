import test from 'node:test';
import assert from 'node:assert/strict';
import { fixture, actor } from './fixture.ts';
import { sixMessageSources, oldTime } from './messages-scan-fixture.ts';
import { scanMessages } from '../src/features/notifications/scan.ts';
import { markRead } from '../src/features/notifications/mark-read.ts';
import { unreadCount } from '../src/features/notifications/read.ts';
import { messageScanHealth } from '../src/features/notifications/health.ts';
import { notificationFixture } from './messages-fixture.ts';

test('B8c六类源生成正确目标、同周期重复不新增且已读不重置', async () => {
  const c = await fixture();
  try {
    const { now } = await sixMessageSources(c.db);
    await scanMessages(c.db, now);
    const before = await c.db.all('SELECT * FROM notifications ORDER BY id');
    assert.equal(new Set(before.map((r) => r.type)).size, 6);
    assert.equal(before.length, 7);
    for (const row of before) {
      const prefix = row.object_type === 'stocktake' ? 'stocktakes' : row.object_type;
      const path =
        row.object_type === 'catalog'
          ? '/catalog'
          : row.object_type === 'backup'
            ? '/maintenance'
            : `/${prefix}/${encodeURIComponent(String(row.object_id))}`;
      assert.equal(row.link_path, path);
    }
    await markRead(c.db, actor, String(before[0]!.id));
    await Promise.all([scanMessages(c.db, now), scanMessages(c.db, now)]);
    const after = await c.db.all('SELECT * FROM notifications ORDER BY id');
    assert.deepEqual(
      after.map((r) => r.id),
      before.map((r) => r.id),
    );
    assert.ok(after[0]!.read_at);
    assert.equal((await unreadCount(c.db)).unreadCount, 6);
    assert.equal((await messageScanHealth(c.db)).status, 'succeeded');
  } finally {
    await c.dispose();
  }
});
test('B8c条件解除退出未读，重现或锚点变化产生新周期', async () => {
  const c = await fixture();
  try {
    const { now, receipt } = await sixMessageSources(c.db);
    await scanMessages(c.db, now);
    await c.db.run("UPDATE inbound_receipts SET posting_state='voided' WHERE id=?", [receipt.id]);
    await c.db.run("UPDATE outbound_orders SET scan_closed_at=? WHERE id='DEMO-001'", [oldTime(now, 9)]);
    await scanMessages(c.db, now);
    const rows = await c.db.all('SELECT * FROM notifications');
    assert.equal(rows.length, 9);
    assert.equal(rows.filter((r) => r.resolved_at).length, 3);
    assert.equal((await unreadCount(c.db)).unreadCount, 6);
    await c.db.run("UPDATE inbound_receipts SET posting_state='pending' WHERE id=?", [receipt.id]);
    await scanMessages(c.db, now);
    assert.equal(
      Number((await c.db.get('SELECT COUNT(*) AS n FROM notifications WHERE object_id=?', [receipt.id]))?.n),
      2,
    );
  } finally {
    await c.dispose();
  }
});
test('B8c过期仅清已读或解除；活动未读保留，清理后持续事件不重发', async () => {
  const c = await fixture();
  try {
    const { now } = await sixMessageSources(c.db);
    await scanMessages(c.db, now);
    const active = await c.db.all('SELECT id FROM notifications ORDER BY id');
    await markRead(c.db, actor, String(active[0]!.id));
    await c.db.run('UPDATE notifications SET created_at=?,expires_at=?', [oldTime(now, 91), oldTime(now, 1)]);
    const resolved = await notificationFixture(c.db, { createdAt: oldTime(now, 100), resolvedAt: oldTime(now, 95) });
    await scanMessages(c.db, now);
    assert.equal(Number((await c.db.get('SELECT COUNT(*) AS n FROM notifications'))?.n), 6);
    assert.equal(await c.db.get('SELECT id FROM notifications WHERE id=?', [resolved]), undefined);
    await scanMessages(c.db, now);
    assert.equal(Number((await c.db.get('SELECT COUNT(*) AS n FROM notifications'))?.n), 6);
  } finally {
    await c.dispose();
  }
});
test('B8c未揭示盲盘无差异通知，源失败事务回滚且状态可查', async () => {
  const c = await fixture();
  try {
    const { now, take } = await sixMessageSources(c.db);
    await c.db.run("UPDATE stocktakes SET mode='blind',revealed_at=NULL WHERE id=?", [take.id]);
    await scanMessages(c.db, now);
    assert.equal(Number((await c.db.get("SELECT COUNT(*) AS n FROM notifications WHERE type='anomaly'"))?.n), 0);
    await c.db.run('UPDATE stocktakes SET revealed_at=UTC_TIMESTAMP(3) WHERE id=?', [take.id]);
    await c.db.run(
      "CREATE TRIGGER b8c_fail BEFORE INSERT ON notifications FOR EACH ROW SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='B8c injected failure'",
    );
    const before = await c.db.all('SELECT * FROM notifications ORDER BY id');
    await assert.rejects(scanMessages(c.db, now), /B8c injected failure/);
    assert.deepEqual(await c.db.all('SELECT * FROM notifications ORDER BY id'), before);
    assert.equal((await messageScanHealth(c.db)).status, 'failed');
    await c.db.run('DROP TRIGGER b8c_fail');
    await scanMessages(c.db, now);
    assert.equal(Number((await c.db.get("SELECT COUNT(*) AS n FROM notifications WHERE type='anomaly'"))?.n), 1);
  } finally {
    await c.dispose();
  }
});
