import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createTestDatabase } from '../../../scripts/mysql/test-database.ts';
import { migrateUp, migrateDown } from '../src/db/migrate.ts';
import { tableFingerprints } from '../../../scripts/b4a-fingerprint.ts';

test('015 empty up/down/up restores identical audit structure', async () => {
  const c = await createTestDatabase('014_master_code_counters');
  try {
    await migrateUp(c.db, '015_audit_attempts');
    const before = await c.db.get('SHOW CREATE TABLE operation_log');
    await migrateDown(c.db);
    assert.equal(await c.db.get("SHOW TABLES LIKE 'operation_attempts'"), undefined);
    assert.equal(await c.db.get("SHOW COLUMNS FROM operation_log LIKE 'attempt_id'"), undefined);
    await migrateUp(c.db, '015_audit_attempts');
    assert.deepEqual(await c.db.get('SHOW CREATE TABLE operation_log'), before);
    console.log('B6C1_MIGRATION empty=up/down/up structure_identical=true');
  } finally {
    await c.dispose();
  }
});

for (const source of ['operation_log', 'operation_attempts'] as const) {
  test(`015 refuses nonempty ${source} before DDL and preserves all evidence`, async () => {
    const c = await createTestDatabase('015_audit_attempts');
    try {
      if (source === 'operation_log')
        await c.db.run(`INSERT INTO operation_log
        (action,target_id,actor,trace_id,before_json,after_json,created_at)
        VALUES('legacy','old','owner','old-trace','{}','{}',UTC_TIMESTAMP(3))`);
      else
        await c.db.run(`INSERT INTO operation_attempts
        (attempt_id,action,result,effect_state,error_code,failure_reason,trace_id,occurred_at,input_summary)
        VALUES(UUID(),'inbound.confirm','failed','not_applied','CONFLICT','状态已变化','trace',UTC_TIMESTAMP(3),'{}')`);
      const before = await tableFingerprints(c.db);
      const structure = await c.db.get(`SHOW CREATE TABLE ${source}`);
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
      await assert.rejects(migrateDown(c.db), new RegExp(`${source} 含有数据`));
      assert.deepEqual(
        statements.filter((sql) => /^(CREATE|ALTER|DROP|TRUNCATE)/i.test(sql.trim())),
        [],
      );
      assert.deepEqual(await tableFingerprints(c.db), before);
      assert.deepEqual(await c.db.get(`SHOW CREATE TABLE ${source}`), structure);
      console.log(`B6C1_MIGRATION nonempty=${source} refused=true ddl=0 structure_and_data_unchanged=true`);
    } finally {
      await c.dispose();
    }
  });
}

test('015 preserves historical NULL channel and result without inventing evidence', async () => {
  const c = await createTestDatabase('014_master_code_counters');
  try {
    await c.db.run(`INSERT INTO operation_log(action,target_id,actor,trace_id,before_json,after_json,created_at)
      VALUES('export.failed','job','owner','trace','{}','{}',UTC_TIMESTAMP(3))`);
    await migrateUp(c.db, '015_audit_attempts');
    const row = await c.db.get('SELECT channel,result,attempt_id FROM operation_log');
    assert.deepEqual(row, { channel: null, result: null, attempt_id: null });
  } finally {
    await c.dispose();
  }
});
