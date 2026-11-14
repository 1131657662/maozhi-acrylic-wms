import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { fixture, actor } from './fixture.ts';
import { migrateUp, migrateDown } from '../src/db/migrate.ts';
import { assertStocktakeDiscoveryReady } from '../src/db/stocktake-discovery-migration.ts';
import { businessFingerprint } from './lifecycle-fixture.ts';
import { createStocktake } from '../src/features/stocktake/create.ts';
import { createDiscovery } from '../src/features/stocktake/discovery-command.ts';
import { discoveryProduct, discoveryInput } from './stocktake-discovery-fixture.ts';
import { voidStocktake } from '../src/features/stocktake/void.ts';

test('B6e-2 025 空表up/down保留原数据与024，未迁移拒绝启动', async () => {
  const c = await fixture('024_stocktake_blind');
  try {
    await assert.rejects(assertStocktakeDiscoveryReady(c.db), /025/);
    const before = await businessFingerprint(c.db);
    await migrateUp(c.db);
    await assertStocktakeDiscoveryReady(c.db);
    assert.equal((await c.db.all("SHOW TRIGGERS LIKE 'stocktake_discovery_lines'")).length, 3);
    await migrateDown(c.db);
    assert.deepEqual(await businessFingerprint(c.db), before);
    await assert.rejects(assertStocktakeDiscoveryReady(c.db), /025/);
    await migrateUp(c.db);
  } finally {
    await c.dispose();
  }
});
test('B6e-2 025 非空在DDL前拒绝down，作废发现行仍不可删改', async () => {
  const c = await fixture();
  try {
    await discoveryProduct(c.db);
    const take = await createStocktake(c.db, { warehouseCode: 'DEMO-WH' }, randomUUID(), actor);
    const line = await createDiscovery(c.db, { id: take.id, input: discoveryInput, key: randomUUID(), actor });
    await voidStocktake(c.db, {
      id: take.id,
      input: { expectedRevision: 1, reason: '迁移验证' },
      key: randomUUID(),
      actor,
    });
    const before = await businessFingerprint(c.db);
    await assert.rejects(migrateDown(c.db), /stocktake_discovery_lines.*含有数据/);
    assert.deepEqual(await businessFingerprint(c.db), before);
    await assert.rejects(c.db.run('DELETE FROM stocktake_discovery_lines WHERE id=?', [line.id]), /immutable/);
    await assert.rejects(
      c.db.run('UPDATE stocktake_discovery_lines SET reason=?,version=version+1 WHERE id=?', ['改写', line.id]),
      /closed/,
    );
    assert.equal((await c.db.all("SHOW TRIGGERS LIKE 'stocktake_discovery_lines'")).length, 3);
  } finally {
    await c.dispose();
  }
});
