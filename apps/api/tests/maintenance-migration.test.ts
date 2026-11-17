import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { fixture } from './fixture.ts';
import { migrateUp, migrateDown } from '../src/db/migrate.ts';
import { insertBackup } from '../src/features/maintenance/jobs.ts';
import { maintenanceActor as actor } from './maintenance-fixture.ts';
import { businessFingerprint } from './lifecycle-fixture.ts';

test('B8a-1 026空表up/down/up保留原业务数据', async () => {
  const c = await fixture('025_stocktake_discoveries');
  try {
    const before = await businessFingerprint(c.db);
    await migrateUp(c.db, '026_maintenance');
    assert.ok(await c.db.get("SHOW TABLES LIKE 'maintenance_jobs'"));
    await migrateDown(c.db);
    assert.deepEqual(await businessFingerprint(c.db), before);
    assert.equal(await c.db.get("SHOW TABLES LIKE 'maintenance_jobs'"), undefined);
    await migrateUp(c.db, '026_maintenance');
    assert.equal((await c.db.get("SELECT state FROM schema_migrations WHERE id='026_maintenance'"))?.state, 'applied');
  } finally {
    await c.dispose();
  }
});
for (const table of ['maintenance_jobs', 'backup_artifacts', 'scheduler_runs']) {
  test(`B8a-1 026 ${table}非空在DDL前拒绝down`, async () => {
    const c = await fixture('026_maintenance');
    try {
      if (table === 'scheduler_runs')
        await c.db.run(`INSERT INTO scheduler_runs VALUES(?,'retention',UTC_TIMESTAMP(3),'succeeded','{}')`, [
          randomUUID(),
        ]);
      else {
        const id = await insertBackup(c.db, actor, randomUUID());
        if (table === 'backup_artifacts')
          await c.db.run(`INSERT INTO backup_artifacts VALUES(?,?,?,1,?,UTC_TIMESTAMP(3),'daily')`, [
            id,
            id,
            `${id}.sql`,
            'a'.repeat(64),
          ]);
      }
      await assert.rejects(migrateDown(c.db), new RegExp(`${table}.*含有数据`));
      assert.equal(
        (await c.db.get("SELECT state FROM schema_migrations WHERE id='026_maintenance'"))?.state,
        'applied',
      );
      for (const name of ['maintenance_jobs', 'backup_artifacts', 'scheduler_runs'])
        assert.ok(await c.db.get('SHOW TABLES LIKE ?', [name]));
    } finally {
      await c.dispose();
    }
  });
}
