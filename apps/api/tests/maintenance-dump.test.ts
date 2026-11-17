import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes, randomUUID } from 'node:crypto';
import { maintenanceFixture, maintenanceActor } from './maintenance-fixture.ts';
import { MaintenanceService } from '../src/features/maintenance/service.ts';
import { quoteDatabase } from '../../../scripts/mysql/local-config.ts';

test('B8a-1 真实备份只需目标库读取/视图/触发器权限，不依赖全局PROCESS或RELOAD', async () => {
  const c = await maintenanceFixture();
  const username = `backup_test_${randomBytes(6).toString('hex')}`,
    password = randomBytes(24).toString('hex');
  const service = new MaintenanceService(c.db, {
    ...c.options,
    connection: { ...c.options.connection, user: username, password },
  });
  try {
    await c.db.run("CREATE USER ?@'127.0.0.1' IDENTIFIED BY ?", [username, password]);
    await c.db.run(`GRANT SELECT,SHOW VIEW,TRIGGER ON ${quoteDatabase(c.name)}.* TO ?@'127.0.0.1'`, [username]);
    const { jobId } = await service.create(maintenanceActor, randomUUID());
    await service.settled();
    const job = await c.db.get('SELECT status,error FROM maintenance_jobs WHERE id=?', [jobId]);
    assert.equal(job?.status, 'succeeded', String(job?.error));
    assert.ok(Number((await c.db.get('SELECT bytes FROM backup_artifacts WHERE job_id=?', [jobId]))?.bytes) > 0);
  } finally {
    await service.settled();
    try {
      await c.db.run("DROP USER IF EXISTS ?@'127.0.0.1'", [username]);
    } finally {
      await c.dispose();
    }
  }
});
