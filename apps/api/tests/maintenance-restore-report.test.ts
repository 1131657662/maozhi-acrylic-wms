import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { backupForRestore, restoreFixture } from './restore-fixture.ts';
import { restoreDetail, jsonValue } from '../src/features/maintenance/restore-records.ts';
import { backupBaselineSchema } from '@wms/contracts';

test('B8a-2 无基线旧备份明确有限核验，不伪造数据通过', async () => {
  const c = await restoreFixture();
  try {
    const artifactId = await backupForRestore(c);
    await c.db.run('UPDATE backup_artifacts SET baseline=NULL WHERE id=?', [artifactId]);
    const { jobId } = await c.service.restores.create(c.actor, randomUUID(), { artifactId, confirmation: 'RECOVER' });
    await c.service.settled();
    const detail = await restoreDetail(c.db, jobId);
    assert.equal(detail.job.status, 'succeeded', JSON.stringify(detail));
    assert.equal(detail.report?.outcome, 'limited');
    assert.equal(detail.report?.baselineAt, null);
    assert.ok(
      detail.report?.items
        .filter((item) => item.label !== '恢复副本会话清空（单列例外）')
        .every((item) => item.conclusion === 'unverified'),
    );
  } finally {
    await c.dispose();
  }
});
test('B8a-2 基线差异形成失败报告并保留隔离库', async () => {
  const c = await restoreFixture();
  try {
    const artifactId = await backupForRestore(c);
    const baseline = backupBaselineSchema.parse(
      jsonValue((await c.db.get('SELECT baseline FROM backup_artifacts WHERE id=?', [artifactId]))?.baseline),
    );
    baseline.inventory.packages = '999';
    await c.db.run('UPDATE backup_artifacts SET baseline=? WHERE id=?', [JSON.stringify(baseline), artifactId]);
    const { jobId } = await c.service.restores.create(c.actor, randomUUID(), { artifactId, confirmation: 'RECOVER' });
    await c.service.settled();
    const detail = await restoreDetail(c.db, jobId);
    assert.equal(detail.job.status, 'failed');
    assert.equal(detail.report?.outcome, 'mismatch');
    const item = detail.report?.items.find((row) => row.label === '库存总包数');
    assert.equal(item?.expected, '999');
    assert.equal(item?.actual, '6');
    assert.equal(item?.conclusion, 'mismatch');
    assert.equal(item?.difference, '差额 -993');
    assert.ok(detail.databaseRetained && detail.accountLocked);
  } finally {
    await c.dispose();
  }
});
