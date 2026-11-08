import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { createTestDatabase } from '../../../scripts/mysql/test-database.ts';
import { fixture, actor } from './fixture.ts';
import { migrateUp, migrateDown } from '../src/db/migrate.ts';
import { assertStocktakeReady } from '../src/db/stocktake-readiness.ts';
import { businessFingerprint } from './lifecycle-fixture.ts';
import { createStocktake } from '../src/features/stocktake/create.ts';

test('B3a 009 空表down/up、历史逐表不变、任一盘点非空拒绝down', async () => {
  const empty = await createTestDatabase('009_stocktake');
  try {
    await migrateDown(empty.db);
    await assert.rejects(assertStocktakeReady(empty.db), /009/);
    await migrateUp(empty.db, '009_stocktake');
    await assertStocktakeReady(empty.db);
    console.log('B3A_MIGRATION empty_down=success re_up=success old_schema_start=refused');
  } finally {
    await empty.dispose();
  }
  const { db, dispose } = await fixture('008_document_lifecycle');
  try {
    const before = await businessFingerprint(db);
    await migrateUp(db, '009_stocktake');
    const after = await businessFingerprint(db);
    for (const table of Object.keys(before).filter((t) => t !== 'schema_migrations'))
      assert.equal(after[table], before[table], table);
    await createStocktake(db, { warehouseCode: 'DEMO-WH' }, randomUUID(), actor);
    const occupied = await businessFingerprint(db);
    let refusal = '';
    try {
      await migrateDown(db);
    } catch (e) {
      refusal = String(e);
    }
    assert.match(refusal, /拒绝回退：stocktakes 含有数据/);
    assert.deepEqual(await businessFingerprint(db), occupied);
    console.log(
      `B3A_MIGRATION historical_tables_unchanged=${Object.keys(before).length - 1} nonempty_down=${refusal} no_DDL=true`,
    );
  } finally {
    await dispose();
  }
});
