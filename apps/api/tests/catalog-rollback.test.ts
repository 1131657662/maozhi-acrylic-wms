import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { catalogFixture, upload, actor, catalogSnapshot } from './catalog-fixture.ts';
import { publishCatalog } from '../src/features/catalog/publish.ts';
import { uploadCatalog } from '../src/features/catalog/upload.ts';
import { head } from '../src/features/catalog/repository.ts';

test('发布各写入阶段失败全部回滚，原键可恢复并重放', async () => {
  for (const [table, event] of [
    ['catalog_versions', 'UPDATE'],
    ['catalog_head', 'UPDATE'],
    ['operation_log', 'INSERT'],
    ['idempotent_commands', 'INSERT'],
  ]) {
    const { db, dispose } = await catalogFixture();
    try {
      const version = (await upload(db, '规格 A 300')).version!;
      const cmd = {
        versionId: version.versionId,
        baseRevision: version.baseRevision,
        contentSha256: version.contentSha256,
        key: randomUUID(),
        actor,
        enabled: true,
      };
      const before = await catalogSnapshot(db);
      await db.run(
        `CREATE TRIGGER catalog_fail AFTER ${event} ON ${table} FOR EACH ROW SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='CATALOG injected failure'`,
      );
      await assert.rejects(publishCatalog(db, cmd));
      assert.deepEqual(await catalogSnapshot(db), before);
      assert.equal((await head(db))?.versionId, 1);
      await db.run('DROP TRIGGER catalog_fail');
      const result = await publishCatalog(db, cmd);
      assert.deepEqual(await publishCatalog(db, cmd), result);
      console.log(`B1C1_ROLLBACK publish after=${table} current=v1 all_tables_unchanged=true retry_same_key=success`);
    } finally {
      await dispose();
    }
  }
});
test('上传条目中途或候选完成后失败，无半套候选', async () => {
  for (const [table, event] of [
    ['catalog_entries', 'INSERT'],
    ['catalog_versions', 'UPDATE'],
    ['operation_log', 'INSERT'],
    ['idempotent_commands', 'INSERT'],
  ]) {
    const { db, dispose } = await catalogFixture();
    try {
      const before = await catalogSnapshot(db);
      await db.run(
        `CREATE TRIGGER catalog_fail AFTER ${event} ON ${table} FOR EACH ROW SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='CATALOG injected upload failure'`,
      );
      const cmd = {
        bytes: Buffer.from('规格 A 300\n规格 B 302'),
        encoding: 'utf-8',
        fileName: 'sku.txt',
        key: randomUUID(),
        actor,
      };
      await assert.rejects(uploadCatalog(db, cmd));
      assert.deepEqual(await catalogSnapshot(db), before);
      console.log(`B1C1_ROLLBACK upload after=${table} all_tables_unchanged=true`);
    } finally {
      await dispose();
    }
  }
});
