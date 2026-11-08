import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fixture } from './fixture.ts';
import { prepared, commandFor, businessFingerprint, injectLifecycleFailure } from './lifecycle-fixture.ts';
import { executeLifecycle } from '../src/features/document-lifecycle/execute.ts';

for (const kind of ['inbound', 'outbound'] as const) {
  test(`B2a ${kind} 7个写入阶段真实MySQL故障全部回滚，同键可恢复`, async () => {
    const { db, dispose } = await fixture();
    try {
      const target = await prepared(db, kind),
        command = await commandFor(db, target);
      const before = await businessFingerprint(db);
      const stages: [string, 'INSERT' | 'UPDATE'][] = [
        ['inventory_operations', 'INSERT'],
        ['stock', 'UPDATE'],
        ['stock_journal', 'INSERT'],
        [kind === 'inbound' ? 'inbound_receipts' : 'outbound_orders', 'UPDATE'],
        ['document_closures', 'INSERT'],
        ['operation_log', 'INSERT'],
        ['idempotent_commands', 'INSERT'],
      ];
      for (const [table, event] of stages) {
        await injectLifecycleFailure(db, table, event);
        try {
          await assert.rejects(executeLifecycle(db, command), /B2A injected failure/);
        } finally {
          await db.run('DROP TRIGGER b2a_fail');
        }
        assert.deepEqual(await businessFingerprint(db), before);
        console.log(`B2A_FAILURE kind=${kind} after=${table} database_unchanged=true partial_writes=0`);
      }
      const after = await executeLifecycle(db, command);
      assert.equal(after.status, 'cancelled');
      console.log(`B2A_RECOVERY kind=${kind} same_key_retry=success`);
    } finally {
      await dispose();
    }
  });
}
