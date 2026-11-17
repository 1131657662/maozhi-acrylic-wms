import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { backupForRestore, restoreFixture } from './restore-fixture.ts';
import { insertRestore, restoreDetail } from '../src/features/maintenance/restore-records.ts';
import {
  createRestoreAccount,
  createRestoreDatabase,
  newRestoreOwnership,
} from '../src/features/maintenance/restore-account.ts';
import { openDatabase } from '../src/db/mysql.ts';
import { MaintenanceService } from '../src/features/maintenance/service.ts';

test('B8a-2 幂等重试复用，换正文及不同键并发拒绝', async () => {
  const c = await restoreFixture();
  try {
    const artifactId = await backupForRestore(c),
      key = randomUUID(),
      body = { artifactId, confirmation: 'RECOVER' as const };
    const [one, two] = await Promise.all([
      c.service.restores.create(c.actor, key, body),
      c.service.restores.create(c.actor, key, body),
    ]);
    assert.deepEqual(one, two);
    await assert.rejects(c.service.restores.create(c.actor, key, { ...body, artifactId: randomUUID() }), /请求已用于/);
    await assert.rejects(c.service.restores.create(c.actor, randomUUID(), body), /维护操作/);
    await c.service.settled();
    assert.deepEqual(await c.service.restores.create(c.actor, key, body), one);
    assert.equal(Number((await c.db.get("SELECT COUNT(*) AS n FROM maintenance_jobs WHERE kind='restore'"))?.n), 1);
  } finally {
    await c.dispose();
  }
});
test('B8a-2 重启中断保留数据库，锁定账号并终止原连接', async () => {
  const c = await restoreFixture();
  let connection: ReturnType<typeof openDatabase> | undefined;
  try {
    const artifactId = await backupForRestore(c),
      id = await insertRestore(c.db, { actor: c.actor, key: randomUUID(), artifactId });
    const owner = newRestoreOwnership(id, c.name);
    await createRestoreDatabase(owner);
    const config = await createRestoreAccount(owner);
    connection = openDatabase(config);
    await connection.ping();
    await c.db.run(
      "UPDATE restore_verifications SET database_name=?,account_name=?,database_created=1,account_created=1,stage='import' WHERE job_id=?",
      [owner.database, owner.account, id],
    );
    await c.db.run("UPDATE maintenance_jobs SET status='running' WHERE id=?", [id]);
    await new MaintenanceService(c.db, c.options).recover();
    const detail = await restoreDetail(c.db, id);
    assert.equal(detail.job.status, 'interrupted');
    assert.ok(detail.databaseRetained && detail.accountLocked);
    assert.equal(
      Number(
        (await c.db.get('SELECT COUNT(*) AS n FROM information_schema.PROCESSLIST WHERE USER=?', [owner.account]))?.n,
      ),
      0,
    );
    await assert.rejects(connection.ping(), /locked/);
  } finally {
    await connection?.close();
    await c.dispose();
  }
});
