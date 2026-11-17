import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFile, writeFile, unlink } from 'node:fs/promises';
import path from 'node:path';
import { artifactFixture } from './maintenance-fixture.ts';
import { backupForRestore, originalBusinessFingerprint, restoreFixture } from './restore-fixture.ts';
import { restoreDetail } from '../src/features/maintenance/restore-records.ts';
import { verifySuccessfulBackup } from '../src/features/maintenance/restore-prebackup.ts';
import { RestoreSqlGuard } from '../src/features/maintenance/restore-sql.ts';

for (const kind of ['use', 'qualified'] as const) {
  test(`B8a-2 ${kind}跨库SQL被拒绝，原业务不变且副本和阶段证据保留`, async () => {
    const c = await restoreFixture();
    try {
      const content =
        kind === 'use'
          ? `USE \`${c.name}\`; UPDATE stock SET packages=0;`
          : `UPDATE \`${c.name}\`.stock SET packages=0;`;
      const file = await artifactFixture(c.db, { root: c.options.directory, at: new Date().toISOString(), content });
      const before = await originalBusinessFingerprint(c);
      const { jobId } = await c.service.restores.create(c.actor, randomUUID(), {
        artifactId: file.id,
        confirmation: 'RECOVER',
      });
      await c.service.settled();
      const detail = await restoreDetail(c.db, jobId);
      assert.equal(detail.job.status, 'failed');
      assert.equal(detail.stage, 'import');
      assert.ok(detail.databaseRetained && detail.accountLocked);
      assert.ok(detail.evidence.length >= 4);
      assert.match(detail.job.error!, kind === 'use' ? /切换数据库/ : /数据库错误编号 (1044|1142)/);
      assert.deepEqual(await originalBusinessFingerprint(c), before);
      const audits = await c.db.all('SELECT action FROM operation_log WHERE target_id=?', [jobId]);
      assert.deepEqual(
        audits.map((row) => row.action).sort(),
        [
          'maintenance.restore',
          'maintenance.restore.account',
          'maintenance.restore.failed',
          'maintenance.restore.import.failed',
        ].sort(),
      );
    } finally {
      await c.dispose();
    }
  });
}
test('B8a-2 预备份失败不创建隔离库且无导入阶段', async () => {
  const c = await restoreFixture();
  try {
    const artifactId = await backupForRestore(c);
    await c.db.run("UPDATE app_meta SET value='wrong' WHERE meta_key='identity'");
    const { jobId } = await c.service.restores.create(c.actor, randomUUID(), { artifactId, confirmation: 'RECOVER' });
    await c.service.settled();
    const detail = await restoreDetail(c.db, jobId);
    assert.equal(detail.job.status, 'failed');
    assert.equal(detail.stage, 'backup');
    assert.equal(detail.databaseRetained, false);
    assert.match(detail.job.error!, /预备份/);
    assert.equal(
      (await c.db.get('SELECT database_name FROM restore_verifications WHERE job_id=?', [jobId]))?.database_name,
      null,
    );
  } finally {
    await c.dispose();
  }
});
test('B8a-2 预备份成功判定拒绝空文件、同大小篡改及缺失文件', async () => {
  const c = await restoreFixture();
  try {
    const artifactId = await backupForRestore(c),
      filename = path.join(c.options.directory, `${artifactId}.sql`);
    const original = await readFile(filename);
    await writeFile(filename, Buffer.alloc(0));
    await assert.rejects(verifySuccessfulBackup(c.db, c.options, artifactId), /预备份/);
    const changed = Buffer.from(original);
    changed[0] = changed[0]! ^ 1;
    await writeFile(filename, changed);
    await assert.rejects(verifySuccessfulBackup(c.db, c.options, artifactId), /预备份/);
    await unlink(filename);
    await assert.rejects(verifySuccessfulBackup(c.db, c.options, artifactId), /预备份/);
  } finally {
    await c.dispose();
  }
});
test('B8a-2 SQL切库检查覆盖注释与同一行多语句，不误判字符串', () => {
  for (const sql of ['USE current;', 'SELECT 1; USE current;', '/*!50000 USE current */;'])
    assert.throws(() => new RestoreSqlGuard().scan(sql), /切换数据库/);
  new RestoreSqlGuard().scan("INSERT INTO t VALUES('USE current'); -- USE current");
});
