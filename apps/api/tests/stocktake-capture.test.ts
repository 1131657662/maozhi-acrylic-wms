import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { fixture, actor } from './fixture.ts';
import { createStocktake } from '../src/features/stocktake/create.ts';
import { saveReading } from '../src/features/stocktake/save-reading.ts';
import { stocktakePreview } from '../src/features/stocktake/preview.ts';
import { stocktakeLines } from '../src/features/stocktake/read-model.ts';
import { stocktakeQuerySchema } from '@wms/contracts';
import { createInbound } from '../src/features/inbound/create.ts';
import { confirmInbound } from '../src/features/inbound/confirm.ts';
import { newReceipt } from './numbering-fixture.ts';
import { businessFingerprint } from './lifecycle-fixture.ts';

test('B3a 快照不可变、未录不等于零、并发开始只占一个窗口', async () => {
  const { db, dispose } = await fixture();
  try {
    const races = await Promise.allSettled(
      Array.from({ length: 20 }, () => createStocktake(db, { warehouseCode: 'DEMO-WH' }, randomUUID(), actor)),
    );
    const winners = races.filter((r) => r.status === 'fulfilled');
    assert.equal(winners.length, 1);
    const take = winners[0]!.value;
    const lines = await stocktakeLines(db, take.id, stocktakeQuerySchema.parse({}));
    assert.equal(lines.items[0]!.actual, null);
    assert.equal(take.snapshotPackages, 6);
    await assert.rejects(
      db.run('UPDATE stocktake_snapshots SET packages=0 WHERE stocktake_id=?', [take.id]),
      /immutable/,
    );
    await assert.rejects(db.run('DELETE FROM stocktake_snapshots WHERE stocktake_id=?', [take.id]), /immutable/);
    const command = {
      id: take.id,
      productCode: 'ACR-032',
      input: { expectedRevision: 0, actual: { packages: 5, weightGrams: 1523100 } },
      key: randomUUID(),
      actor,
    };
    const result = await saveReading(db, command);
    assert.deepEqual(await saveReading(db, command), result);
    assert.equal(result.packagesDelta, -1);
    assert.equal(result.weightDeltaGrams, -276900);
    const preview = await stocktakePreview(db, take.id);
    assert.equal(preview.stocktake.snapshotHash, take.snapshotHash);
    assert.equal(preview.stocktake.revision, 1);
    console.log(
      'B3A_CAPTURE start_concurrent=20 winners=1 immutable=true unrecorded_is_null=true reading_replay=once snapshot_unchanged=true',
    );
  } finally {
    await dispose();
  }
});
test('B3a 未入账预览绑定单据，暂停确认409且失败不写库', async () => {
  const { db, dispose } = await fixture();
  try {
    const take = await createStocktake(db, { warehouseCode: 'DEMO-WH' }, randomUUID(), actor);
    const first = await stocktakePreview(db, take.id);
    const receipt = await createInbound(db, newReceipt(), randomUUID(), actor);
    const second = await stocktakePreview(db, take.id);
    assert.notEqual(first.token, second.token);
    assert.deepEqual(
      second.unposted.map((r) => [r.number, r.packages, r.weightGrams]),
      [[receipt.receiptNo, receipt.packages, receipt.weightGrams]],
    );
    const before = await businessFingerprint(db);
    await assert.rejects(
      confirmInbound(db, receipt.id, randomUUID(), actor),
      (e) => e instanceof Error && e.message.includes(take.number),
    );
    assert.deepEqual(await businessFingerprint(db), before);
    console.log('B3A_UNPOSTED preview_changed=true unposted_count=1 paused_confirm=409 database_unchanged=true');
  } finally {
    await dispose();
  }
});
