import test from 'node:test';
import assert from 'node:assert/strict';
import { setImmediate } from 'node:timers/promises';
import { maintenanceFixture } from './maintenance-fixture.ts';
import { MaintenanceScheduler } from '../src/features/maintenance/scheduler.ts';

test('B8c备份查询被阻塞时后续消息轮次仍能执行，关闭等待在途任务', async () => {
  const c = await maintenanceFixture();
  let release!: () => void;
  const held = new Promise<void>((resolve) => {
    release = resolve;
  });
  let scanned!: () => void;
  const firstScan = new Promise<void>((resolve) => {
    scanned = resolve;
  });
  let scannedAgain!: () => void;
  const secondScan = new Promise<void>((resolve) => {
    scannedAgain = resolve;
  });
  const get = c.db.get.bind(c.db);
  c.db.get = async (sql, values) => {
    if (sql.includes('MAX(finished_at)')) await held;
    return get(sql, values);
  };
  let scans = 0;
  const scheduler = new MaintenanceScheduler(
    c.service,
    () => new Date('2026-11-16T18:00:00Z'),
    async () => {
      if (++scans === 1) scanned();
      else scannedAgain();
    },
  );
  try {
    const first = scheduler.check();
    await firstScan;
    await setImmediate();
    const second = scheduler.check();
    await secondScan;
    assert.equal(scans, 2);
    release();
    await Promise.all([first, second, scheduler.stop()]);
  } finally {
    release();
    await scheduler.stop();
    await c.dispose();
  }
});
