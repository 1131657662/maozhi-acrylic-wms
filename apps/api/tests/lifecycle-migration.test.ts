import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createTestDatabase } from '../../../scripts/mysql/test-database.ts';
import { migrateDown, migrateUp } from '../src/db/migrate.ts';
import { fixture } from './fixture.ts';
import { businessFingerprint } from './lifecycle-fixture.ts';
import { assertLifecycleReady } from '../src/db/lifecycle-readiness.ts';

test('B2a 008 空表up/down；非空升级不改变历史业务数据，down无DDL拒绝', async () => {
  const empty = await createTestDatabase();
  try {
    await migrateDown(empty.db);
    await assert.rejects(assertLifecycleReady(empty.db), /008/);
    await migrateUp(empty.db);
    await assertLifecycleReady(empty.db);
    console.log('B2A_MIGRATION 008 empty_down=success re_up=success old_schema_start=refused');
  } finally {
    await empty.dispose();
  }
  const context = await fixture('007_pda_handoff');
  try {
    const before = await businessFingerprint(context.db);
    await migrateUp(context.db);
    const after = await businessFingerprint(context.db);
    for (const table of Object.keys(before).filter((t) => t !== 'schema_migrations'))
      assert.equal(after[table], before[table], table);
    assert.equal(
      (await context.db.get("SELECT basis FROM outbound_plan_exposures WHERE plan_id='DEMO-001'"))?.basis,
      'pre-migration-unknown',
    );
    let refusal = '';
    try {
      await migrateDown(context.db);
    } catch (e) {
      refusal = String(e);
    }
    assert.match(refusal, /拒绝回退：outbound_plan_exposures 含有数据/);
    assert.deepEqual(await businessFingerprint(context.db), after);
    console.log(`B2A_MIGRATION 008 historical_fingerprints=unchanged down_nonempty=${refusal} no_DDL=true`);
  } finally {
    await context.dispose();
  }
});
