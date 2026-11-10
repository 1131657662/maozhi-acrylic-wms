import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { createTestDatabase } from '../../../scripts/mysql/test-database.ts';
import { migrateDown, migrateUp } from '../src/db/migrate.ts';
import { tableFingerprints } from '../../../scripts/b4a-fingerprint.ts';

test('013 列偏好空库 up/down/up，只回退013', async () => {
  const c = await createTestDatabase('012_master_data_snapshots');
  try {
    await migrateUp(c.db, '013_list_preferences');
    assert.ok(await c.db.get("SHOW TABLES LIKE 'user_list_preferences'"));
    await migrateDown(c.db);
    assert.equal(await c.db.get("SHOW TABLES LIKE 'user_list_preferences'"), undefined);
    assert.ok(await c.db.get("SELECT id FROM schema_migrations WHERE id='012_master_data_snapshots'"));
    await migrateUp(c.db, '013_list_preferences');
    assert.ok(await c.db.get("SHOW TABLES LIKE 'user_list_preferences'"));
    console.log('B6B_PREFERENCES_MIGRATION empty=up/down/up success');
  } finally {
    await c.dispose();
  }
});

test('013 非空 down 在任何 DDL 前拒绝，结构/数据/迁移状态不变', async () => {
  const c = await createTestDatabase('013_list_preferences');
  try {
    await c.db.run('INSERT INTO user_list_preferences VALUES(?,?,?,?,?,UTC_TIMESTAMP(3))', [
      randomUUID(),
      'fixture',
      'inbound',
      1,
      '{}',
    ]);
    const before = await tableFingerprints(c.db);
    const ddl = await c.db.get('SHOW CREATE TABLE user_list_preferences');
    const statements: string[] = [];
    const withConnection = c.db.withConnection.bind(c.db);
    c.db.withConnection = (work) =>
      withConnection(async (connection) => {
        const run = connection.run.bind(connection);
        connection.run = (sql, values) => {
          statements.push(sql);
          return run(sql, values);
        };
        return work(connection);
      });
    await assert.rejects(migrateDown(c.db), /user_list_preferences 含有数据/);
    assert.deepEqual(
      statements.filter((sql) => /^(CREATE|ALTER|DROP|TRUNCATE)/i.test(sql.trim())),
      [],
    );
    assert.deepEqual(await tableFingerprints(c.db), before);
    assert.deepEqual(await c.db.get('SHOW CREATE TABLE user_list_preferences'), ddl);
    console.log('B6B_PREFERENCES_MIGRATION nonempty=refused ddl=0 dataUnchanged=true');
  } finally {
    await c.dispose();
  }
});
