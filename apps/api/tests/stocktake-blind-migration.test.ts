import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { fixture, actor } from './fixture.ts';
import { createStocktake } from '../src/features/stocktake/create.ts';
import { migrateUp, migrateDown } from '../src/db/migrate.ts';
import { assertStocktakeBlindReady } from '../src/db/stocktake-blind-migration.ts';
import { businessFingerprint } from './lifecycle-fixture.ts';

test('B6e-1 024 历史盘点默认为明盘，快照不变；无盲盘证据可安全回退', async () => {
  const c = await fixture('023_catalog_candidate_abandons');
  try {
    await c.db.run(
      `INSERT INTO stocktakes(id,number,warehouse_code,scope_kind,status,snapshot_at,
      journal_watermark,snapshot_hash,line_count,created_by)
      VALUES(?,'PD-LEGACY','DEMO-WH','warehouse','completed',UTC_TIMESTAMP(3),0,'legacy',0,'owner')`,
      [randomUUID()],
    );
    const before = await c.db.all('SELECT * FROM stocktake_snapshots');
    await assert.rejects(assertStocktakeBlindReady(c.db), /024/);
    await migrateUp(c.db, '024_stocktake_blind');
    await assertStocktakeBlindReady(c.db);
    assert.deepEqual(await c.db.get('SELECT mode,revealed_at FROM stocktakes'), { mode: 'open', revealed_at: null });
    assert.deepEqual(await c.db.all('SELECT * FROM stocktake_snapshots'), before);
    await migrateDown(c.db);
    assert.equal(await c.db.get("SHOW COLUMNS FROM stocktakes LIKE 'mode'"), undefined);
    assert.equal(Number((await c.db.get('SELECT COUNT(*) AS n FROM stocktakes'))?.n), 1);
    await migrateUp(c.db);
  } finally {
    await c.dispose();
  }
});

test('B6e-1 024 已有盲盘即拒绝 down 且数据、迁移状态均不变', async () => {
  const c = await fixture();
  try {
    await createStocktake(c.db, { warehouseCode: 'DEMO-WH', mode: 'blind' }, randomUUID(), actor);
    await migrateDown(c.db); // Remove empty 025 before the nonempty 024 guard.
    const before = await businessFingerprint(c.db);
    await assert.rejects(migrateDown(c.db), /拒绝回退.*盲盘/);
    assert.deepEqual(await businessFingerprint(c.db), before);
    await assert.rejects(c.db.run("UPDATE stocktakes SET mode='invalid'"), { code: 'ER_CHECK_CONSTRAINT_VIOLATED' });
  } finally {
    await c.dispose();
  }
});
