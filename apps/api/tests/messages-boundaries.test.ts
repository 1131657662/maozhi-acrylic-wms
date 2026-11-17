import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { fixture, actor } from './fixture.ts';
import { sixMessageSources, oldTime } from './messages-scan-fixture.ts';
import { scanMessages } from '../src/features/notifications/scan.ts';
import {
  pendingSources,
  overdueSources,
  stocktakeSources,
  catalogSources,
} from '../src/features/notifications/source-documents.ts';
import { anomalySources } from '../src/features/notifications/source-alerts.ts';
import { insertBackup } from '../src/features/maintenance/jobs.ts';
import { sqlDate } from '../src/db/dates.ts';

test('B8c时间恰好达阈值才触发，空扫码时间和终态不猜测', async () => {
  const c = await fixture();
  try {
    const { now, receipt, take } = await sixMessageSources(c.db);
    await c.db.run('UPDATE inbound_receipts SET created_at=? WHERE id=?', [oldTime(now, 2 / 24), receipt.id]);
    await c.db.run("UPDATE outbound_orders SET scan_closed_at=? WHERE id='DEMO-001'", [oldTime(now, 7)]);
    await c.db.run('UPDATE stocktake_windows SET started_at=? WHERE stocktake_id=?', [oldTime(now, 1), take.id]);
    await c.db.run(
      'UPDATE catalog_versions SET published_at=? WHERE version_id=(SELECT active_version_id FROM catalog_head WHERE id=1)',
      [oldTime(now, 30)],
    );
    const justBefore = new Date(now.getTime() - 1);
    assert.equal((await pendingSources(c.db, justBefore)).filter((r) => r.object_type === 'inbound').length, 0);
    assert.equal((await pendingSources(c.db, now)).filter((r) => r.object_type === 'inbound').length, 1);
    for (const read of [overdueSources, stocktakeSources, catalogSources]) {
      assert.equal((await read(c.db, justBefore)).length, 0);
      assert.equal((await read(c.db, now)).length, 1);
    }
    await c.db.run("UPDATE outbound_orders SET scan_closed_at=NULL WHERE id='DEMO-001'");
    assert.equal((await overdueSources(c.db, now)).length, 0);
    await c.db.run("UPDATE outbound_orders SET scan_closed_at=?,status='confirmed' WHERE id='DEMO-001'", [
      oldTime(now, 8),
    ]);
    assert.equal((await overdueSources(c.db, now)).length, 0);
  } finally {
    await c.dispose();
  }
});

test('B8c差异等于阈值不提醒，超过阈值才提醒且完结即消失', async () => {
  const c = await fixture();
  try {
    const { take } = await sixMessageSources(c.db);
    const snapshot = Number(
      (
        await c.db.get("SELECT packages FROM stocktake_snapshots WHERE stocktake_id=? AND product_code='ACR-032'", [
          take.id,
        ])
      )?.packages,
    );
    const threshold = Math.max(snapshot * 0.1, 50);
    await c.db.run("UPDATE stocktake_readings SET packages=? WHERE stocktake_id=? AND product_code='ACR-032'", [
      snapshot + threshold,
      take.id,
    ]);
    assert.equal((await anomalySources(c.db)).length, 0);
    await c.db.run(
      "UPDATE stocktake_readings SET packages=packages+1 WHERE stocktake_id=? AND product_code='ACR-032'",
      [take.id],
    );
    assert.equal((await anomalySources(c.db)).length, 1);
    await c.db.run("UPDATE stocktakes SET status='voided' WHERE id=?", [take.id]);
    assert.equal((await anomalySources(c.db)).length, 0);
  } finally {
    await c.dispose();
  }
});

test('B8c关联备份调度不重复提醒，后续备份成功解除失败通知', async () => {
  const c = await fixture();
  try {
    const { now, job } = await sixMessageSources(c.db);
    await c.db.run("INSERT INTO scheduler_runs VALUES(?,'backup',?,'failed',?)", [
      randomUUID(),
      sqlDate(now.toISOString()),
      JSON.stringify({ jobId: job }),
    ]);
    await c.db.run("INSERT INTO scheduler_runs VALUES(?,'backup',?,'interrupted','{}')", [
      randomUUID(),
      sqlDate(now.toISOString()),
    ]);
    await scanMessages(c.db, now);
    assert.equal(Number((await c.db.get("SELECT COUNT(*) AS n FROM notifications WHERE type='backup_failed'"))?.n), 2);
    const success = await insertBackup(c.db, actor, randomUUID());
    const later = new Date(now.getTime() + 1000);
    await c.db.run("UPDATE maintenance_jobs SET status='succeeded',finished_at=? WHERE id=?", [
      sqlDate(later.toISOString()),
      success,
    ]);
    await scanMessages(c.db, later);
    assert.equal(
      Number(
        (await c.db.get("SELECT COUNT(*) AS n FROM notifications WHERE type='backup_failed' AND resolved_at IS NULL"))
          ?.n,
      ),
      0,
    );
    assert.equal((await c.db.get('SELECT status FROM maintenance_jobs WHERE id=?', [job]))?.status, 'failed');
  } finally {
    await c.dispose();
  }
});
