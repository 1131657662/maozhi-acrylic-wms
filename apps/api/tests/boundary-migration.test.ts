import test from 'node:test';
import assert from 'node:assert/strict';
import { fixture } from './fixture.ts';
import { migrateUp, migrateDown } from '../src/db/migrate.ts';
import { assertBoundaryReady } from '../src/db/boundary-readiness.ts';
import { tableFingerprints } from '../../../scripts/b4a-fingerprint.ts';

test('B4a 010历史行保留、空备注可down/up；有备注拒绝down且无DDL', async () => {
  const f = await fixture('009_stocktake');
  try {
    await assert.rejects(assertBoundaryReady(f.db), /010/);
    const before = await tableFingerprints(f.db);
    await migrateUp(f.db);
    await assertBoundaryReady(f.db);
    const after = await tableFingerprints(f.db, before);
    for (const table of Object.keys(before).filter((name) => name !== 'schema_migrations'))
      assert.deepEqual(after[table], before[table]);
    assert.equal(Number((await f.db.get('SELECT COUNT(*) AS n FROM outbound_orders WHERE memo IS NOT NULL'))?.n), 0);
    await migrateDown(f.db);
    assert.deepEqual(await tableFingerprints(f.db), before);
    await migrateUp(f.db);
    await f.db.run("UPDATE outbound_orders SET memo='必须保留的备注' WHERE id='DEMO-001'");
    const occupied = await tableFingerprints(f.db);
    await assert.rejects(migrateDown(f.db), /memo 含有数据/);
    assert.deepEqual(await tableFingerprints(f.db), occupied);
    console.log(
      'B4A_010_GUARDS historical_rows=unchanged null_down_up=success memo_nonnull_down=refused old_schema_start=refused',
    );
  } finally {
    await f.dispose();
  }
});
