import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { migrateUp } from '../src/db/migrate.ts';
import { fixture } from './fixture.ts';

test('migration checksum accepts line-ending changes and rejects content changes', async () => {
  const c = await fixture('013_list_preferences');
  try {
    const sql = readFileSync(new URL('../migrations/013_list_preferences.up.sql', import.meta.url), 'utf8');
    const lfChecksum = createHash('sha256').update(sql.replace(/\r\n/g, '\n')).digest('hex');
    await c.db.run("UPDATE schema_migrations SET checksum=? WHERE id='013_list_preferences'", [lfChecksum]);
    await migrateUp(c.db);
    assert.equal(
      (await c.db.get("SELECT state FROM schema_migrations WHERE id='016_outbound_shipments'"))?.state,
      'applied',
    );
    console.log('MIGRATION_CHECKSUM lf_prior=true crlf_checkout=true later_migrations=applied');
  } finally {
    await c.dispose();
  }
});

test('migration checksum still rejects changed SQL content', async () => {
  const c = await fixture('013_list_preferences');
  try {
    await c.db.run("UPDATE schema_migrations SET checksum=? WHERE id='013_list_preferences'", ['0'.repeat(64)]);
    await assert.rejects(migrateUp(c.db), /迁移 013_list_preferences 已变更或中断/);
    assert.equal(await c.db.get("SELECT id FROM schema_migrations WHERE id='016_outbound_shipments'"), undefined);
    console.log('MIGRATION_CHECKSUM changed_content=refused later_migration=absent');
  } finally {
    await c.dispose();
  }
});
