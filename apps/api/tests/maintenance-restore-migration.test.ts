import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { fixture } from './fixture.ts';
import { migrateUp, migrateDown } from '../src/db/migrate.ts';
import { artifactFixture, maintenanceActor } from './maintenance-fixture.ts';
import { localMaintenanceOptions } from '../src/features/maintenance/options.ts';
import { adminConfig } from '../../../scripts/mysql/local-config.ts';
import { insertRestore } from '../src/features/maintenance/restore-records.ts';

test('B8a-2 027保留旧备份空基线并支持无证据down/up', async () => {
  const c = await fixture('026_maintenance');
  try {
    const name = String((await c.db.get('SELECT DATABASE() AS name'))?.name);
    const file = await artifactFixture(c.db, {
      root: localMaintenanceOptions({ ...adminConfig(), database: name }).directory,
      at: new Date().toISOString(),
    });
    await migrateUp(c.db);
    assert.equal((await c.db.get('SELECT baseline FROM backup_artifacts WHERE id=?', [file.id]))?.baseline, null);
    await migrateDown(c.db);
    assert.ok(await c.db.get('SELECT id FROM backup_artifacts WHERE id=?', [file.id]));
    await migrateUp(c.db);
    assert.ok(await c.db.get("SHOW TABLES LIKE 'restore_verifications'"));
  } finally {
    await c.dispose();
  }
});
for (const evidence of ['baseline', 'restore'] as const) {
  test(`B8a-2 027存在${evidence}证据时在DDL前拒绝down`, async () => {
    const c = await fixture();
    try {
      const name = String((await c.db.get('SELECT DATABASE() AS name'))?.name);
      const file = await artifactFixture(c.db, {
        root: localMaintenanceOptions({ ...adminConfig(), database: name }).directory,
        at: new Date().toISOString(),
      });
      if (evidence === 'baseline') await c.db.run("UPDATE backup_artifacts SET baseline='{}' WHERE id=?", [file.id]);
      else await insertRestore(c.db, { actor: maintenanceActor, key: randomUUID(), artifactId: file.id });
      await assert.rejects(migrateDown(c.db), /含有数据/);
      assert.equal(
        (await c.db.get("SELECT state FROM schema_migrations WHERE id='027_restore_baselines'"))?.state,
        'applied',
      );
    } finally {
      await c.dispose();
    }
  });
}
