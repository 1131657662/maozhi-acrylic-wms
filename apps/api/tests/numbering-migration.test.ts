import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createTestDatabase } from '../../../scripts/mysql/test-database.ts';
import { migrateUp, migrateDown } from '../src/db/migrate.ts';

test('004 空表可 down/up；非空规则或计数器必须拒绝 down 且保留迁移状态', async () => {
  const { db, dispose } = await createTestDatabase();
  try {
    await migrateDown(db);
    assert.equal(await db.get("SELECT id FROM schema_migrations WHERE id='004_document_numbering'"), undefined);
    await migrateUp(db);
    await db.run("INSERT INTO document_number_rules(kind,sequence_width) VALUES('inbound',4)");
    for (const stage of ['rules', 'counters']) {
      if (stage === 'counters')
        await db.run(
          "INSERT INTO document_number_counters(kind,date_key,last_sequence) VALUES('inbound','20261108',1)",
        );
      let refusal = '';
      try {
        await migrateDown(db);
      } catch (error) {
        refusal = error instanceof Error ? error.message : String(error);
      }
      assert.match(refusal, /拒绝回退：document_number_(rules|counters) 含有数据/);
      assert.equal(
        (await db.get("SELECT state FROM schema_migrations WHERE id='004_document_numbering'"))?.state,
        'applied',
      );
      assert.equal(Number((await db.get('SELECT COUNT(*) AS n FROM document_number_rules'))?.n), 1);
      assert.equal(
        Number((await db.get('SELECT COUNT(*) AS n FROM document_number_counters'))?.n),
        stage === 'counters' ? 1 : 0,
      );
      console.log(
        `B1A_MIGRATION_DOWN ${JSON.stringify({ nonempty: stage, output: refusal, state: 'applied', dataPreserved: true })}`,
      );
    }
  } finally {
    await dispose();
  }
});
