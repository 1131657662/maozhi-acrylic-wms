import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { maintenanceFixture, maintenanceActor as actor } from './maintenance-fixture.ts';
import { MaintenanceScheduler } from '../src/features/maintenance/scheduler.ts';
import { scheduleDay, startupOverdue, scheduleEnabled } from '../src/features/maintenance/schedule-plan.ts';
import { insertBackup } from '../src/features/maintenance/jobs.ts';
import { withMaintenanceLock } from '../src/features/maintenance/lock.ts';
import { backupHealth } from '../src/features/maintenance/backup-health.ts';
import { sqlDate } from '../src/db/dates.ts';

test('B8a-1 上海03:00与严格超过24h边界，测试默认关闭调度', () => {
  assert.deepEqual(scheduleDay(new Date('2026-11-16T18:59:59Z')), { day: '2026-11-17', due: false });
  assert.deepEqual(scheduleDay(new Date('2026-11-16T19:00:00Z')), { day: '2026-11-17', due: true });
  assert.equal(startupOverdue('2026-11-16T00:00:00Z', new Date('2026-11-17T00:00:00Z')), false);
  assert.equal(startupOverdue('2026-11-15T23:59:59Z', new Date('2026-11-17T00:00:00Z')), true);
  assert.equal(startupOverdue(null, new Date()), true);
  assert.equal(scheduleEnabled({ NODE_ENV: 'test' }), false);
  assert.equal(scheduleEnabled({ NODE_ENV: 'test', MAINTENANCE_SCHEDULER_ENABLED: 'true' }), true);
  assert.equal(scheduleEnabled({ MAINTENANCE_SCHEDULER_ENABLED: 'false' }), false);
  assert.equal(scheduleEnabled({}), true);
});
test('B8a-1 到期自动备份真实产物；同日检查与重启不重复，跨日再执行', async () => {
  const c = await maintenanceFixture();
  try {
    let now = new Date('2026-11-16T18:59:59Z');
    const scheduler = new MaintenanceScheduler(c.service, () => now);
    await scheduler.check();
    assert.equal(Number((await c.db.get('SELECT COUNT(*) AS n FROM maintenance_jobs'))?.n), 0);
    now = new Date('2026-11-16T19:00:00Z');
    await Promise.all([scheduler.check(), scheduler.check()]);
    assert.equal((await c.db.get('SELECT status FROM scheduler_runs'))?.status, 'succeeded');
    await scheduler.check();
    await new MaintenanceScheduler(c.service, () => now).check(true);
    assert.equal(Number((await c.db.get('SELECT COUNT(*) AS n FROM maintenance_jobs'))?.n), 1);
    now = new Date('2026-11-17T19:00:00Z');
    await scheduler.check();
    assert.equal(Number((await c.db.get('SELECT COUNT(*) AS n FROM backup_artifacts'))?.n), 2);
    assert.equal(Number((await c.db.get('SELECT COUNT(*) AS n FROM scheduler_runs'))?.n), 2);
    assert.match(
      String(
        (
          await c.db.get(
            "SELECT JSON_UNQUOTE(JSON_EXTRACT(params,'$.trigger')) AS trigger_kind FROM maintenance_jobs LIMIT 1",
          )
        )?.trigger_kind,
      ),
      /daily/,
    );
  } finally {
    await c.dispose();
  }
});
test('B8a-1 启动超24小时补跑一次，并与当日到期合并', async () => {
  const c = await maintenanceFixture();
  try {
    const id = await insertBackup(c.db, actor, randomUUID());
    const now = new Date();
    await c.db.run("UPDATE maintenance_jobs SET status='succeeded',started_at=?,finished_at=? WHERE id=?", [
      sqlDate(new Date(now.getTime() - 26 * 3600000).toISOString()),
      sqlDate(new Date(now.getTime() - 25 * 3600000).toISOString()),
      id,
    ]);
    const scheduler = new MaintenanceScheduler(c.service, () => now);
    await scheduler.check(true);
    await scheduler.check();
    assert.equal(Number((await c.db.get('SELECT COUNT(*) AS n FROM backup_artifacts'))?.n), 1);
    assert.equal(
      (await c.db.get("SELECT JSON_UNQUOTE(JSON_EXTRACT(detail,'$.trigger')) AS trigger_kind FROM scheduler_runs"))
        ?.trigger_kind,
      'startup',
    );
    await new MaintenanceScheduler(c.service, () => now).check(true);
    assert.equal(Number((await c.db.get('SELECT COUNT(*) AS n FROM scheduler_runs'))?.n), 1);
  } finally {
    await c.dispose();
  }
});
test('B8a-1 已有维护持锁时自动任务跳过，不排队或重复建任务', async () => {
  const c = await maintenanceFixture();
  try {
    const scheduler = new MaintenanceScheduler(c.service, () => new Date('2026-11-16T19:00:00Z'));
    await withMaintenanceLock(c.db, () => scheduler.check());
    const run = await c.db.get('SELECT status,detail FROM scheduler_runs');
    assert.equal(run?.status, 'skipped');
    assert.match(JSON.stringify(run?.detail), /不排队/);
    await scheduler.check();
    assert.equal(Number((await c.db.get('SELECT COUNT(*) AS n FROM maintenance_jobs'))?.n), 0);
    assert.equal(Number((await c.db.get('SELECT COUNT(*) AS n FROM scheduler_runs'))?.n), 1);
  } finally {
    await c.dispose();
  }
});
test('B8a-1 自动备份失败时间/原因可查；后续成功不抹掉失败历史', async () => {
  const c = await maintenanceFixture();
  try {
    await c.db.run("UPDATE app_meta SET value='incorrect' WHERE meta_key='identity'");
    await new MaintenanceScheduler(c.service).check(true);
    assert.equal((await c.db.get('SELECT status FROM scheduler_runs'))?.status, 'failed');
    const health = await backupHealth(c.db);
    assert.equal(health.status, 'error');
    assert.match(health.lastFailure?.reason ?? '', /不一致/);
    assert.ok(health.lastFailure?.at);
    assert.equal(health.latestSchedule?.status, 'failed');
    await c.db.run("UPDATE app_meta SET value='maozhi-local-mysql8-v1' WHERE meta_key='identity'");
    await c.service.create(actor, randomUUID());
    await c.service.settled();
    const recovered = await backupHealth(c.db);
    assert.equal(recovered.latest?.status, 'succeeded');
    assert.deepEqual(recovered.lastFailure, health.lastFailure);
  } finally {
    await c.dispose();
  }
});
