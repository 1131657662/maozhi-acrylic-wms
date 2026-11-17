import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fixture } from './fixture.ts';
import { migrateDown, migrateUp } from '../src/db/migrate.ts';

test('028保留旧会话并回填独立编号、UTC创建时间', async () => {
  const c = await fixture('027_restore_baselines');
  try {
    const at = Date.UTC(2026, 10, 17, 1);
    await c.db.run('INSERT INTO sessions(token_hash,username,channel,expires_at) VALUES(?,?,?,?)', [
      'a'.repeat(64),
      'owner',
      'pda',
      at + 28_800_000,
    ]);
    await migrateUp(c.db);
    const row = await c.db.get('SELECT * FROM sessions');
    assert.match(String(row?.id), /^[0-9a-f-]{36}$/);
    assert.equal(row?.created_at, '2026-11-17 01:00:00.000');
    assert.equal(row?.epoch, 0);
    assert.equal(row?.token_hash, 'a'.repeat(64));
    await assert.rejects(migrateDown(c.db), /拒绝回退.*会话含有数据/);
  } finally {
    await c.dispose();
  }
});

test('028空扩展数据可down/up且owner口令不变', async () => {
  const c = await fixture();
  try {
    const before = await c.db.get('SELECT username,password_hash FROM owner');
    await migrateDown(c.db);
    assert.equal((await c.db.all("SHOW COLUMNS FROM owner LIKE 'auth_epoch'")).length, 0);
    await migrateUp(c.db);
    assert.deepEqual(await c.db.get('SELECT username,password_hash FROM owner'), before);
  } finally {
    await c.dispose();
  }
});

for (const field of ['display_name', 'password_changed_at', 'auth_epoch', 'failed_attempts', 'locked_until']) {
  test(`028 ${field}有值时在DDL前拒绝回退`, async () => {
    const c = await fixture();
    try {
      const value =
        field === 'display_name'
          ? '仓管'
          : field.endsWith('_at') || field === 'locked_until'
            ? '2026-11-17 00:00:00.000'
            : 1;
      await c.db.run(`UPDATE owner SET ${field}=?`, [value]);
      await assert.rejects(migrateDown(c.db), /拒绝回退/);
      assert.ok(await c.db.get("SHOW COLUMNS FROM sessions LIKE 'id'"));
      assert.equal(
        (await c.db.get("SELECT state FROM schema_migrations WHERE id='028_auth_extensions'"))?.state,
        'applied',
      );
    } finally {
      await c.dispose();
    }
  });
}
