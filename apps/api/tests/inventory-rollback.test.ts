import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { fixture, actor } from './fixture.ts';
import { newReceipt } from './numbering-fixture.ts';
import { adjustment, failAfter, frozenOrder, inventorySnapshot } from './inventory-fixture.ts';
import { createInbound } from '../src/features/inbound/create.ts';
import { confirmInbound } from '../src/features/inbound/confirm.ts';
import { confirmOutbound } from '../src/features/outbound/confirm.ts';
import { adjustStock } from '../src/features/stock/adjust.ts';

for (const kind of ['inbound', 'outbound', 'adjustment'] as const) {
  test(`${kind} 每个写入阶段失败：状态/库存/流水/操作/审计/幂等全部回滚，原键可重试`, async () => {
    const { db, dispose } = await fixture();
    try {
      const receipt = await createInbound(db, newReceipt(), randomUUID(), actor);
      const frozen = await frozenOrder(db);
      const key = randomUUID();
      const run = () =>
        kind === 'inbound'
          ? confirmInbound(db, receipt.id, key, actor)
          : kind === 'outbound'
            ? confirmOutbound(db, { planId: frozen.id, expected: frozen, key, actor })
            : adjustStock(db, adjustment(), key, actor);
      const stages: [string, 'INSERT' | 'UPDATE'][] = [
        ['inventory_operations', 'INSERT'],
        ['stock', 'UPDATE'],
        ['stock_journal', 'INSERT'],
      ];
      if (kind !== 'adjustment') stages.push([kind === 'inbound' ? 'inbound_receipts' : 'outbound_orders', 'UPDATE']);
      stages.push(['operation_log', 'INSERT'], ['idempotent_commands', 'INSERT']);
      for (const [table, event] of stages) {
        const before = await inventorySnapshot(db);
        await failAfter(db, table, event);
        try {
          await assert.rejects(run(), /B1A injected failure/);
        } finally {
          await db.run('DROP TRIGGER b1a_fail');
        }
        assert.deepEqual(await inventorySnapshot(db), before);
        console.log(`B1A3_ROLLBACK kind=${kind} fail_after=${table} all_tables_unchanged=true`);
      }
      const result = await run();
      assert.deepEqual(await run(), result);
      console.log(`B1A3_ROLLBACK kind=${kind} retry_same_key=success replay_same=true`);
    } finally {
      await dispose();
    }
  });
}
