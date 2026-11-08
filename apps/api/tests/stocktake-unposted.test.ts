import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fixture, actor, fact } from './fixture.ts';
import { counted, postCommand } from './stocktake-fixture.ts';
import { recordFact } from '../src/features/scan/service.ts';
import { stocktakePreview } from '../src/features/stocktake/preview.ts';
import { postStocktake } from '../src/features/stocktake/post.ts';
import { businessFingerprint } from './lifecycle-fixture.ts';

test('B3a 快照前出库单收到离线补传，计划与实扫分列，旧确认失效', async () => {
  const { db, dispose } = await fixture();
  try {
    await db.run("UPDATE outbound_orders SET created_at='2020-01-01' WHERE id='DEMO-001'");
    const initial = await counted(db);
    assert.equal(initial.unposted.length, 0);
    await recordFact(db, { planId: 'DEMO-001', fact: fact(), actor });
    const next = await stocktakePreview(db, initial.stocktake.id);
    assert.notEqual(next.token, initial.token);
    assert.equal(next.unposted.length, 1);
    assert.equal(next.unposted[0]!.packages, 2);
    assert.equal(next.unposted[0]!.weightGrams, 600000);
    assert.equal(next.unposted[0]!.scannedPackages, 1);
    assert.equal(next.unposted[0]!.scannedWeightGrams, 302500);
    const before = await businessFingerprint(db),
      command = postCommand(initial);
    command.input.acknowledgeSnapshotBasis = true;
    await assert.rejects(postStocktake(db, command), /清单已变化/);
    assert.deepEqual(await businessFingerprint(db), before);
    console.log(
      'B3A_LATE_FACT older_order=true upload_during_pause=success planned=2/0.6000 scanned=1/0.3025 stale_ack=409 unchanged=true',
    );
  } finally {
    await dispose();
  }
});
