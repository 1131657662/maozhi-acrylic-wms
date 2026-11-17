import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash, randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { maintenanceFixture, maintenanceActor as actor } from './maintenance-fixture.ts';
import { MaintenanceService } from '../src/features/maintenance/service.ts';
import { insertBackup } from '../src/features/maintenance/jobs.ts';

test('B8a-1 真实备份文件大小和SHA一致，重试复用原任务', async () => {
  const c = await maintenanceFixture();
  try {
    const key = randomUUID();
    const accepted = await c.service.create(actor, key);
    assert.deepEqual(await c.service.create(actor, key), accepted);
    await c.service.settled();
    const job = await c.db.get('SELECT status,error FROM maintenance_jobs WHERE id=?', [accepted.jobId]);
    assert.equal(job?.status, 'succeeded', String(job?.error));
    const artifact = await c.db.get('SELECT * FROM backup_artifacts WHERE job_id=?', [accepted.jobId]);
    const bytes = await readFile(path.join(c.options.directory, String(artifact?.path)));
    assert.equal(bytes.length, Number(artifact?.bytes));
    assert.equal(createHash('sha256').update(bytes).digest('hex'), artifact?.sha256);
    assert.match(bytes.toString(), /CREATE TABLE `stock`/);
    assert.deepEqual(await c.service.create(actor, key), accepted);
    assert.equal(Number((await c.db.get('SELECT COUNT(*) AS n FROM maintenance_jobs'))?.n), 1);
  } finally {
    await c.dispose();
  }
});
test('B8a-1 两个服务实例并发备份只创建一个任务', async () => {
  const c = await maintenanceFixture();
  const other = new MaintenanceService(c.db, c.options);
  try {
    const results = await Promise.allSettled([
      c.service.create(actor, randomUUID()),
      other.create(actor, randomUUID()),
    ]);
    assert.equal(results.filter((r) => r.status === 'fulfilled').length, 1);
    const failure = results.find((r) => r.status === 'rejected');
    assert.equal(failure?.status === 'rejected' ? failure.reason.code : null, 'MAINTENANCE_BUSY');
    await Promise.all([c.service.settled(), other.settled()]);
    assert.equal(Number((await c.db.get('SELECT COUNT(*) AS n FROM maintenance_jobs'))?.n), 1);
  } finally {
    await other.settled();
    await c.dispose();
  }
});
test('B8a-1 数据库身份不匹配保留失败任务，不生成产物', async () => {
  const c = await maintenanceFixture();
  try {
    await c.db.run("UPDATE app_meta SET value='wrong-project' WHERE meta_key='identity'");
    const { jobId } = await c.service.create(actor, randomUUID());
    await c.service.settled();
    assert.equal((await c.db.get('SELECT status FROM maintenance_jobs WHERE id=?', [jobId]))?.status, 'failed');
    assert.equal(Number((await c.db.get('SELECT COUNT(*) AS n FROM backup_artifacts'))?.n), 0);
    assert.equal(
      (await c.db.get("SELECT result FROM operation_log WHERE action='maintenance.backup.failed'"))?.result,
      'failed',
    );
  } finally {
    await c.dispose();
  }
});
test('B8a-1 重启中断任务可查，不自动重跑', async () => {
  const c = await maintenanceFixture();
  try {
    const id = await insertBackup(c.db, actor, randomUUID());
    await c.db.run("UPDATE maintenance_jobs SET status='running' WHERE id=?", [id]);
    await new MaintenanceService(c.db, c.options).recover();
    const row = await c.db.get('SELECT status,finished_at,error FROM maintenance_jobs WHERE id=?', [id]);
    assert.equal(row?.status, 'interrupted');
    assert.ok(row?.finished_at);
    assert.match(String(row?.error), /中断/);
  } finally {
    await c.dispose();
  }
});
