import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFile, writeFile, unlink } from 'node:fs/promises';
import path from 'node:path';
import { MAINTENANCE, type BackupArtifact } from '@wms/contracts';
import { retentionPlan } from '../src/features/maintenance/retention-policy.ts';
import { maintenanceHttpFixture, artifactFixture } from './maintenance-fixture.ts';

const now = Date.parse('2026-11-17T12:00:00Z');
function artifact(createdAt: string): BackupArtifact {
  return { id: randomUUID(), createdAt, bytes: 1, sha256: 'a'.repeat(64), retentionClass: 'daily', hasBaseline: false };
}
test('B8a-1 30日边界全部保护，12上海自然月每月只留最新，未来文件不删', () => {
  const recent = artifact(new Date(now - 30 * MAINTENANCE.dayMs).toISOString());
  const future = artifact('2027-01-01T00:00:00Z');
  const october = artifact('2026-09-17T00:00:00Z'),
    octoberOld = artifact('2026-09-01T00:00:00Z');
  const december = artifact('2025-11-30T16:00:00Z'),
    tooOld = artifact('2025-11-30T15:59:59Z');
  const result = retentionPlan([octoberOld, tooOld, december, recent, october, future], now);
  assert.deepEqual(result.keep, new Set([recent.id, future.id, october.id, december.id]));
  assert.ok(result.monthly.has(december.id));
  assert.ok(!result.keep.has(tooOld.id));
});
function monthDate(offset: number, day: number): string {
  const current = new Date(Date.now() + MAINTENANCE.shanghaiOffsetMs);
  return new Date(Date.UTC(current.getUTCFullYear(), current.getUTCMonth() - offset, day)).toISOString();
}
test('B8a-1 清理仅删除超期登记文件，近30日全部保留，元数据与未登记文件不动', async () => {
  const c = await maintenanceHttpFixture();
  try {
    const create = (at: string) => artifactFixture(c.db, { root: c.options.directory, at });
    const recent = await create(new Date().toISOString()),
      protectedDay = await create(new Date(Date.now() - 29 * MAINTENANCE.dayMs).toISOString());
    const monthly = await create(monthDate(2, 20)),
      old = await create(monthDate(2, 10)),
      yearOld = await create(monthDate(12, 20));
    const unknown = path.join(c.options.directory, 'unregistered.sql');
    await writeFile(unknown, 'keep');
    const response = await c.api
      .post('/api/v1/maintenance/retention')
      .set('Origin', 'http://127.0.0.1:5173')
      .send({})
      .expect(200);
    assert.deepEqual(
      new Set(response.body.data.deleted.map((v: BackupArtifact) => v.id)),
      new Set([old.id, yearOld.id]),
    );
    for (const file of [recent, protectedDay, monthly])
      assert.ok(await readFile(path.join(c.options.directory, `${file.id}.sql`)));
    await assert.rejects(readFile(path.join(c.options.directory, `${old.id}.sql`)), { code: 'ENOENT' });
    assert.equal(await readFile(unknown, 'utf8'), 'keep');
    assert.equal(Number((await c.db.get('SELECT COUNT(*) AS n FROM backup_artifacts'))?.n), 5);
    const list = await c.api.get('/api/v1/maintenance/artifacts').expect(200);
    assert.equal(list.body.data.total, 3);
    await c.api.get(`/api/v1/maintenance/artifacts/${old.id}/download`).expect(404);
    assert.equal((await c.db.get('SELECT status FROM scheduler_runs'))?.status, 'succeeded');
    const repeat = await c.api
      .post('/api/v1/maintenance/retention')
      .set('Origin', 'http://127.0.0.1:5173')
      .send({})
      .expect(200);
    assert.deepEqual(repeat.body.data.deleted, []);
  } finally {
    await c.dispose();
  }
});

test('B8a-1 缺失文件不能冒充清理成功；已登记删除意图的中断操作可重试', async () => {
  const c = await maintenanceHttpFixture();
  try {
    const file = await artifactFixture(c.db, { root: c.options.directory, at: monthDate(13, 10) });
    await unlink(path.join(c.options.directory, `${file.id}.sql`));
    const run = () =>
      c.api.post('/api/v1/maintenance/retention').set('Origin', 'http://127.0.0.1:5173').send({}).expect(200);
    const failed = await run();
    assert.equal(failed.body.data.failures.length, 1);
    assert.equal(failed.body.data.deleted.length, 0);
    assert.equal((await c.db.get('SELECT status FROM scheduler_runs'))?.status, 'failed');
    await c.db.run('UPDATE maintenance_jobs SET result=? WHERE id=?', [
      JSON.stringify({ pendingDeletionAt: new Date().toISOString() }),
      file.id,
    ]);
    const retry = await run();
    assert.equal(retry.body.data.deleted.length, 1);
    assert.deepEqual(retry.body.data.failures, []);
  } finally {
    await c.dispose();
  }
});
