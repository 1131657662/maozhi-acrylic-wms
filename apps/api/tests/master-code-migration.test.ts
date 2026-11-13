import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createTestDatabase } from '../../../scripts/mysql/test-database.ts';
import { migrateUp, migrateDown } from '../src/db/migrate.ts';
import { tableFingerprints } from '../../../scripts/b4a-fingerprint.ts';
import { assertMasterReady } from '../src/db/master-readiness.ts';

test('014 空库up→down→up；未应用014拒绝写服务启动', async () => {
  const c = await createTestDatabase('013_list_preferences');
  try {
    await assert.rejects(assertMasterReady(c.db), /014/);
    await migrateUp(c.db, '014_master_code_counters');
    await assert.rejects(assertMasterReady(c.db), /022/);
    await migrateUp(c.db);
    await assertMasterReady(c.db);
    assert.ok(await c.db.get("SHOW TABLES LIKE 'master_code_counters'"));
    // Remove empty migrations 015-023 before testing the independent 014 rollback.
    for (let migration = 0; migration < 9; migration++) await migrateDown(c.db);
    await migrateDown(c.db);
    assert.equal(await c.db.get("SHOW TABLES LIKE 'master_code_counters'"), undefined);
    assert.equal(await c.db.get("SHOW COLUMNS FROM master_customers LIKE 'legacy_code'"), undefined);
    await migrateUp(c.db, '014_master_code_counters');
    assert.equal((await c.db.get("SHOW COLUMNS FROM document_number_rules LIKE 'sequence_width'"))?.Default, '3');
    console.log('B6A_NUM_MIGRATION empty=up/down/up success readiness014=required');
  } finally {
    await c.dispose();
  }
});

test('014 每个受影响表独立非空都拒绝回退，已删资料只留计数器也不得回收', async () => {
  const c = await createTestDatabase('014_master_code_counters');
  try {
    for (const table of [
      'master_code_counters',
      'master_customers',
      'master_suppliers',
      'master_warehouses',
      'document_number_rules',
    ]) {
      if (table === 'master_code_counters') await c.db.run("INSERT INTO master_code_counters VALUES('C',2)");
      else if (table === 'document_number_rules')
        await c.db.run("INSERT INTO document_number_rules(kind) VALUES('inbound')");
      else
        await c.db.run(
          `INSERT INTO ${table}(code,name,created_at,updated_at) VALUES('OLD','保留资料',UTC_TIMESTAMP(3),UTC_TIMESTAMP(3))`,
        );
      const before = await tableFingerprints(c.db);
      const structure = await c.db.get(`SHOW CREATE TABLE ${table}`);
      await assert.rejects(migrateDown(c.db), new RegExp(`${table} 含有数据`));
      assert.deepEqual(await tableFingerprints(c.db), before);
      assert.deepEqual(await c.db.get(`SHOW CREATE TABLE ${table}`), structure);
      await c.db.run(`DELETE FROM ${table}`); // Only this test's single row in its disposable database.
    }
  } finally {
    await c.dispose();
  }
});

test('014 原编码回填不重编，规范编码取最大值；非空down在DDL前拒绝', async () => {
  const c = await createTestDatabase('013_list_preferences');
  try {
    for (const [table, code] of [
      ['master_customers', 'C00042'],
      ['master_customers', 'OLD-CUSTOMER'],
      ['master_suppliers', 'S0025'],
      ['master_warehouses', 'W08'],
    ]) {
      await c.db.run(
        `INSERT INTO ${table}(code,name,active,created_at,updated_at) VALUES(?,?,1,UTC_TIMESTAMP(3),UTC_TIMESTAMP(3))`,
        [code!, '历史资料'],
      );
    }
    await c.db.run("INSERT INTO document_number_rules(kind,sequence_width) VALUES('inbound',4)");
    await c.db.run("INSERT INTO document_number_counters(kind,date_key,last_sequence) VALUES('inbound','20260101',88)");
    await migrateUp(c.db, '014_master_code_counters');
    for (const table of ['master_customers', 'master_suppliers', 'master_warehouses']) {
      const rows = await c.db.all(`SELECT code,legacy_code FROM ${table}`);
      assert.ok(rows.every((row) => row.code === row.legacy_code));
    }
    const counters = await c.db.all('SELECT * FROM master_code_counters ORDER BY prefix');
    assert.deepEqual(
      counters.map((row) => [row.prefix, row.last_value]),
      [
        ['C', 42],
        ['S', 25],
        ['W', 8],
      ],
    );
    assert.equal(
      (await c.db.get("SELECT sequence_width FROM document_number_rules WHERE kind='inbound'"))?.sequence_width,
      3,
    );
    assert.equal(String((await c.db.get('SELECT last_sequence FROM document_number_counters'))?.last_sequence), '88');
    const before = await tableFingerprints(c.db);
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
    await assert.rejects(migrateDown(c.db), /含有数据/);
    const ddl = statements.filter((sql) => /^(CREATE|ALTER|DROP|TRUNCATE)/i.test(sql.trim()));
    assert.deepEqual(ddl, []);
    assert.deepEqual(await tableFingerprints(c.db), before);
    console.log(
      'B6A_NUM_MIGRATION',
      JSON.stringify({
        counters,
        legacyCodesPreserved: true,
        documentCounter: 88,
        width: 3,
        nonemptyDown: 'refused',
        ddl: ddl.length,
        databaseUnchanged: true,
      }),
    );
  } finally {
    await c.dispose();
  }
});
