import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { artifactFixture } from './maintenance-fixture.ts';
import { restoreFixture } from './restore-fixture.ts';
import { insertRestore, restoreDetail } from '../src/features/maintenance/restore-records.ts';
import {
  createRestoreAccount,
  createRestoreDatabase,
  newRestoreOwnership,
  assertRestoreOwnership,
} from '../src/features/maintenance/restore-account.ts';
import { finishRestoreAccount } from '../src/features/maintenance/restore-finish.ts';
import { retainBackups } from '../src/features/maintenance/retention.ts';
import { BackupFiles } from '../src/features/maintenance/files.ts';

test('B8a-2 账号仅有精确隔离库授权，授权中断仍可识别并锁定', async () => {
  const c = await restoreFixture();
  try {
    const file = await artifactFixture(c.db, { root: c.options.directory, at: new Date().toISOString() });
    const id = await insertRestore(c.db, { actor: c.actor, key: randomUUID(), artifactId: file.id });
    const owner = newRestoreOwnership(id, c.name);
    assert.throws(() => assertRestoreOwnership({ ...owner, source: owner.database }), /归属/);
    await c.db.run('UPDATE restore_verifications SET database_name=?,account_name=? WHERE job_id=?', [
      owner.database,
      owner.account,
      id,
    ]);
    await createRestoreDatabase(owner);
    await createRestoreAccount(owner);
    const grants = await c.db.all("SHOW GRANTS FOR ?@'127.0.0.1'", [owner.account]);
    const text = grants.map((row) => Object.values(row)[0]).join('\n');
    assert.equal(grants.length, 2);
    assert.match(text, /GRANT USAGE ON \*\.\*/);
    assert.ok(text.includes(owner.database.replaceAll('_', '\\_')));
    assert.doesNotMatch(text, /SUPER|FILE|GRANT OPTION|CREATE USER/);
    await finishRestoreAccount(c.db, owner);
    assert.ok((await restoreDetail(c.db, id)).accountLocked);
    assert.ok((await restoreDetail(c.db, id)).databaseRetained);
  } finally {
    await c.dispose();
  }
});

test('B8a-2 恢复证据引用的过期来源与预备份不被保留策略删除', async () => {
  const c = await restoreFixture();
  try {
    const source = await artifactFixture(c.db, { root: c.options.directory, at: '2020-01-01T00:00:00Z' });
    const prebackup = await artifactFixture(c.db, { root: c.options.directory, at: '2020-01-02T00:00:00Z' });
    const id = await insertRestore(c.db, { actor: c.actor, key: randomUUID(), artifactId: source.id });
    await c.db.run('UPDATE restore_verifications SET prebackup_id=? WHERE job_id=?', [prebackup.id, id]);
    const result = await retainBackups(c.db, new BackupFiles(c.options.directory), c.actor);
    assert.equal(result.deleted.length, 0);
    assert.equal(result.retained, 2);
    assert.equal(result.failures.length, 0);
  } finally {
    await c.dispose();
  }
});
