import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { copyFile, mkdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { registerLegacyRestore } from '../../../scripts/mysql/restore-artifact.ts';
import { backupForRestore, restoreFixture } from './restore-fixture.ts';
import { restoreDetail } from '../src/features/maintenance/restore-records.ts';

test('B8a-2 旧CLI产物复制登记后走无基线隔离恢复且原文件不变', async () => {
  const c = await restoreFixture();
  try {
    const originalId = await backupForRestore(c),
      root = path.join(c.options.directory, 'legacy');
    await mkdir(root);
    const filename = path.join(root, 'maozhi-123456.sql');
    await copyFile(path.join(c.options.directory, `${originalId}.sql`), filename);
    const before = await readFile(filename);
    const artifactId = await registerLegacyRestore(c.db, c.actor, { filename, root, options: c.options });
    assert.equal((await c.db.get('SELECT baseline FROM backup_artifacts WHERE id=?', [artifactId]))?.baseline, null);
    const { jobId } = await c.service.restores.create(c.actor, randomUUID(), { artifactId, confirmation: 'RECOVER' });
    await c.service.settled();
    const detail = await restoreDetail(c.db, jobId);
    assert.equal(detail.job.status, 'succeeded');
    assert.equal(detail.report?.outcome, 'limited');
    assert.deepEqual(await readFile(filename), before);
  } finally {
    await c.dispose();
  }
});
