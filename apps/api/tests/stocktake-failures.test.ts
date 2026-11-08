import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fixture, actor } from './fixture.ts';
import { randomUUID } from 'node:crypto';
import { counted, postCommand, injectStocktakeFailure } from './stocktake-fixture.ts';
import { postStocktake } from '../src/features/stocktake/post.ts';
import { createStocktake } from '../src/features/stocktake/create.ts';
import { voidStocktake } from '../src/features/stocktake/void.ts';
import { businessFingerprint } from './lifecycle-fixture.ts';
import { createInbound } from '../src/features/inbound/create.ts';
import { confirmInbound } from '../src/features/inbound/confirm.ts';
import { newReceipt } from './numbering-fixture.ts';
import { stocktakePreview } from '../src/features/stocktake/preview.ts';

test('B3a 回写每阶段故障全表无残留、原键恢复', async () => {
  const { db, dispose } = await fixture();
  try {
    const preview = await counted(db),
      command = postCommand(preview);
    const before = await businessFingerprint(db);
    const stages: [string, 'INSERT' | 'UPDATE'][] = [
      ['inventory_operations', 'INSERT'],
      ['stock', 'UPDATE'],
      ['stock_journal', 'INSERT'],
      ['stocktakes', 'UPDATE'],
      ['stocktake_windows', 'UPDATE'],
      ['operation_log', 'INSERT'],
      ['idempotent_commands', 'INSERT'],
    ];
    for (const [table, event] of stages) {
      await injectStocktakeFailure(db, table, event);
      try {
        await assert.rejects(postStocktake(db, command), /B3A injected failure/);
        assert.deepEqual(await businessFingerprint(db), before);
        console.log(`B3A_ROLLBACK stage=${table} partial_writes=0 window_retained=true`);
      } finally {
        await db.run('DROP TRIGGER b3a_fail');
      }
    }
    await postStocktake(db, command);
    console.log('B3A_ROLLBACK original_key_recovery=success');
  } finally {
    await dispose();
  }
});
test('B3a 开始快照和作废故障不遗留窗口或部分状态', async () => {
  const { db, dispose } = await fixture();
  try {
    const before = await businessFingerprint(db);
    for (const table of [
      'stocktakes',
      'stocktake_windows',
      'stocktake_snapshots',
      'stocktake_readings',
      'operation_log',
      'idempotent_commands',
    ]) {
      await injectStocktakeFailure(db, table, 'INSERT');
      try {
        await assert.rejects(createStocktake(db, { warehouseCode: 'DEMO-WH' }, randomUUID(), actor), /injected/);
        assert.deepEqual(await businessFingerprint(db), before);
        console.log(`B3A_START_ROLLBACK stage=${table} partial_writes=0`);
      } finally {
        await db.run('DROP TRIGGER b3a_fail');
      }
    }
    const take = await createStocktake(db, { warehouseCode: 'DEMO-WH' }, randomUUID(), actor),
      occupied = await businessFingerprint(db);
    await injectStocktakeFailure(db, 'stocktake_windows', 'UPDATE');
    try {
      await assert.rejects(
        voidStocktake(db, {
          id: take.id,
          input: { expectedRevision: 0, reason: '故障演练' },
          key: randomUUID(),
          actor,
        }),
        /injected/,
      );
      assert.deepEqual(await businessFingerprint(db), occupied);
    } finally {
      await db.run('DROP TRIGGER b3a_fail');
    }
    console.log('B3A_VOID_ROLLBACK partial_writes=0 window_retained=true');
  } finally {
    await dispose();
  }
});
test('B3a 开始与入账并发，不漏进窗口；拒绝后库存等于快照', async () => {
  const { db, dispose } = await fixture();
  try {
    for (let n = 0; n < 10; n++) {
      const receipt = await createInbound(db, newReceipt(), randomUUID(), actor);
      const [start, confirm] = await Promise.allSettled([
        createStocktake(db, { warehouseCode: 'DEMO-WH' }, randomUUID(), actor),
        confirmInbound(db, receipt.id, randomUUID(), actor),
      ]);
      assert.equal(start.status, 'fulfilled');
      const preview = await stocktakePreview(db, start.value.id);
      assert.equal(
        preview.blockers.some((b) => b.code === 'STOCKTAKE_STOCK_DRIFT'),
        false,
      );
      await voidStocktake(db, {
        id: start.value.id,
        input: { expectedRevision: 0, reason: '并发隔离验收结束' },
        key: randomUUID(),
        actor,
      });
      console.log(
        `B3A_START_RACE iteration=${n + 1} confirm=${confirm.status === 'fulfilled' ? 200 : 409} snapshot_drift=0`,
      );
    }
  } finally {
    await dispose();
  }
});
