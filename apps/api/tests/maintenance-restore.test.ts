import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { backupForRestore, originalBusinessFingerprint, restoreFixture } from './restore-fixture.ts';
import { restoreDetail } from '../src/features/maintenance/restore-records.ts';
import { openDatabase } from '../src/db/mysql.ts';
import { adminConfig } from '../../../scripts/mysql/local-config.ts';
import { backupBaselineSchema } from '@wms/contracts';
import { jsonValue } from '../src/features/maintenance/restore-records.ts';

test('B8a-2 错误确认词拒绝且没有恢复任务', async () => {
  const c = await restoreFixture();
  try {
    await c.api
      .post('/api/v1/maintenance/restores')
      .set('Origin', 'http://127.0.0.1:5173')
      .set('Idempotency-Key', randomUUID())
      .send({ artifactId: randomUUID(), confirmation: 'recover' })
      .expect(422);
    assert.equal(Number((await c.db.get("SELECT COUNT(*) AS n FROM maintenance_jobs WHERE kind='restore'"))?.n), 0);
  } finally {
    await c.dispose();
  }
});
test('B8a-2 真实隔离恢复对比备份时基线，原业务指纹不变且账号锁定', async () => {
  const c = await restoreFixture();
  try {
    const artifactId = await backupForRestore(c);
    await c.db.run("UPDATE stock SET packages=packages+1 WHERE warehouse_code='DEMO-WH'");
    const before = await originalBusinessFingerprint(c);
    const { jobId } = await c.service.restores.create(c.actor, randomUUID(), { artifactId, confirmation: 'RECOVER' });
    await c.service.settled();
    const detail = await restoreDetail(c.db, jobId);
    assert.equal(
      detail.job.status,
      'succeeded',
      JSON.stringify({
        error: detail.job.error,
        mismatches: detail.report?.items.filter((item) => item.conclusion === 'mismatch'),
      }),
    );
    assert.equal(detail.report?.outcome, 'passed');
    assert.ok(detail.accountLocked);
    assert.deepEqual(await originalBusinessFingerprint(c), before);
    const record = await c.db.get('SELECT database_name,account_name FROM restore_verifications WHERE job_id=?', [
      jobId,
    ]);
    const restored = openDatabase({ ...adminConfig(), database: String(record?.database_name) });
    try {
      assert.equal(Number((await restored.get('SELECT SUM(packages) AS n FROM stock'))?.n), 6);
      assert.equal(detail.report?.items.find((item) => item.label === '库存总包数')?.actual, '6');
      const actual = backupBaselineSchema.parse(
        jsonValue(
          (await c.db.get('SELECT actual_baseline FROM restore_verifications WHERE job_id=?', [jobId]))
            ?.actual_baseline,
        ),
      );
      assert.equal(
        detail.report?.items.find((item) => item.label === '数据表数量')?.actual,
        String(
          (await restored.get('SELECT COUNT(*) AS n FROM information_schema.TABLES WHERE TABLE_SCHEMA=DATABASE()'))?.n,
        ),
      );
      for (const [index, table] of actual.tables.entries()) {
        if (table.name === 'sessions') continue;
        const count = (await restored.get(`SELECT COUNT(*) AS n FROM \`${table.name}\``))?.n;
        assert.equal(
          detail.report?.items.find((item) => item.label === `数据表 ${index + 1}行数`)?.actual,
          String(count),
        );
      }
      assert.equal(
        detail.report?.items.find((item) => item.label === '库存总吨数')?.actual,
        String((await restored.get('SELECT SUM(weight_tonnes) AS n FROM stock'))?.n),
      );
      assert.equal(Number((await restored.get('SELECT COUNT(*) AS n FROM sessions'))?.n), 0);
    } finally {
      await restored.close();
    }
    assert.equal(
      (await c.db.get('SELECT account_locked FROM mysql.user WHERE User=?', [String(record?.account_name)]))
        ?.account_locked,
      'Y',
    );
  } finally {
    await c.dispose();
  }
});
