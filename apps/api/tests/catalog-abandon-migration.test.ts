import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { createTestDatabase } from '../../../scripts/mysql/test-database.ts';
import { migrateUp, migrateDown } from '../src/db/migrate.ts';
import { catalogFixture, upload, actor } from './catalog-fixture.ts';
import { abandonCandidate } from '../src/features/catalog/abandon.ts';

test('023 空表 up/down/up 保持父表及外键类型不变', async () => {
  const c = await createTestDatabase('022_master_search_text');
  try {
    const parent = await c.db.get('SHOW CREATE TABLE catalog_versions');
    await migrateUp(c.db, '023_catalog_candidate_abandons');
    const table = await c.db.get('SHOW CREATE TABLE catalog_candidate_abandons');
    assert.equal((await c.db.get("SHOW COLUMNS FROM catalog_candidate_abandons LIKE 'version_id'"))?.Type, 'int');
    await migrateDown(c.db);
    assert.equal(await c.db.get("SHOW TABLES LIKE 'catalog_candidate_abandons'"), undefined);
    assert.deepEqual(await c.db.get('SHOW CREATE TABLE catalog_versions'), parent);
    await migrateUp(c.db, '023_catalog_candidate_abandons');
    assert.deepEqual(await c.db.get('SHOW CREATE TABLE catalog_candidate_abandons'), table);
  } finally {
    await c.dispose();
  }
});

test('023 正数CHECK、父版本FK、操作号唯一约束与不可变触发器生效', async () => {
  const c = await catalogFixture();
  try {
    const insert = (id: number, operation: string = randomUUID()) =>
      c.db.run(
        `INSERT INTO catalog_candidate_abandons
      VALUES(?,'约束验收','owner',?,UTC_TIMESTAMP(3))`,
        [id, operation],
      );
    for (const id of [0, -1]) await assert.rejects(insert(id), { code: 'ER_CHECK_CONSTRAINT_VIOLATED' });
    await assert.rejects(insert(999999), { code: 'ER_NO_REFERENCED_ROW_2' });
    const v = (await upload(c.db, '')).version!;
    const result = await abandonCandidate(c.db, {
      versionId: v.versionId,
      key: randomUUID(),
      reason: '约束验收',
      actor,
    });
    await assert.rejects(insert(1, result.operationId), { code: 'ER_DUP_ENTRY' });
    await assert.rejects(c.db.run('DELETE FROM catalog_versions WHERE version_id=?', [v.versionId]), {
      code: 'ER_ROW_IS_REFERENCED_2',
    });
    await assert.rejects(c.db.run("UPDATE catalog_candidate_abandons SET reason='修改'"), /immutable/);
    await assert.rejects(c.db.run('DELETE FROM catalog_candidate_abandons'), /immutable/);
  } finally {
    await c.dispose();
  }
});

test('023 非空 down 在任何DDL及迁移状态改变之前拒绝', async () => {
  const c = await catalogFixture();
  try {
    await migrateDown(c.db); // Remove empty 025 before the previous migration boundary.
    await migrateDown(c.db); // Remove empty 024 before checking the 023 evidence guard.
    const v = (await upload(c.db, '')).version!;
    await abandonCandidate(c.db, { versionId: v.versionId, key: randomUUID(), reason: '保留证据', actor });
    const before = await c.db.all('SELECT * FROM catalog_candidate_abandons'),
      statements: string[] = [];
    const connection = c.db.withConnection.bind(c.db);
    c.db.withConnection = (work) =>
      connection(async (db) => {
        const run = db.run.bind(db);
        db.run = (sql, values) => {
          statements.push(sql);
          return run(sql, values);
        };
        return work(db);
      });
    await assert.rejects(migrateDown(c.db), /catalog_candidate_abandons 含有数据/);
    assert.deepEqual(
      statements.filter((sql) => /^(CREATE|ALTER|DROP|TRUNCATE|UPDATE|DELETE)/i.test(sql.trim())),
      [],
    );
    assert.deepEqual(await c.db.all('SELECT * FROM catalog_candidate_abandons'), before);
    assert.equal(
      (await c.db.get("SELECT state FROM schema_migrations WHERE id='023_catalog_candidate_abandons'"))?.state,
      'applied',
    );
  } finally {
    await c.dispose();
  }
});
