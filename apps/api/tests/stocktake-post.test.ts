import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { fixture, actor } from './fixture.ts';
import { counted, postCommand } from './stocktake-fixture.ts';
import { postStocktake } from '../src/features/stocktake/post.ts';
import { stocktakePreview } from '../src/features/stocktake/preview.ts';
import { createInbound } from '../src/features/inbound/create.ts';
import { confirmInbound } from '../src/features/inbound/confirm.ts';
import { newReceipt } from './numbering-fixture.ts';
import { businessFingerprint } from './lifecycle-fixture.ts';

for (const sameKey of [true, false])
  test(`B3a ${sameKey ? '同键' : '异键'}20并发回写只入账一次，全量SQL逐行对账`, async () => {
    const { db, dispose } = await fixture();
    try {
      const preview = await counted(db),
        command = postCommand(preview);
      const replies = await Promise.allSettled(
        Array.from({ length: 20 }, () => postStocktake(db, { ...command, key: sameKey ? command.key : randomUUID() })),
      );
      assert.equal(replies.filter((r) => r.status === 'fulfilled').length, sameKey ? 20 : 1);
      const operation = await db.get(
        "SELECT COUNT(*) AS n FROM inventory_operations WHERE operation_type='stocktake.post' AND target_id=?",
        [command.id],
      );
      assert.equal(Number(operation?.n), 1);
      const sql = readFileSync('scripts/sql/verify-stocktake.sql', 'utf8');
      for (const query of sql
        .replace(/^--.*$/gm, '')
        .split(';')
        .filter((s) => s.trim())) {
        const rows = await db.all(query);
        assert(rows.every((r) => ('balanced' in r ? Number(r.balanced) === 1 : Number(r.mismatches) === 0)));
        console.log(`B3A_SQL ${JSON.stringify(rows)}`);
      }
      assert.equal((await stocktakePreview(db, command.id)).stocktake.snapshotHash, preview.stocktake.snapshotHash);
      const receipt = await createInbound(db, newReceipt(), randomUUID(), actor);
      assert.equal((await confirmInbound(db, receipt.id, randomUUID(), actor)).status, 'confirmed');
      console.log(
        `B3A_POST same_key=${sameKey} concurrency=20 success=${replies.filter((r) => r.status === 'fulfilled').length} conflicts=${replies.filter((r) => r.status === 'rejected').length} operations=1 snapshot_unchanged=true after_complete_confirm=200`,
      );
    } finally {
      await dispose();
    }
  });
test('B3a 未入账默认阻断，显式确认留审计；预览后新单使确认失效', async () => {
  const { db, dispose } = await fixture();
  try {
    const initial = await counted(db),
      id = initial.stocktake.id;
    await createInbound(db, newReceipt(), randomUUID(), actor);
    const preview = await stocktakePreview(db, id),
      command = postCommand(preview);
    const before = await businessFingerprint(db);
    await assert.rejects(postStocktake(db, command), /默认禁止回写/);
    assert.deepEqual(await businessFingerprint(db), before);
    await createInbound(db, newReceipt(), randomUUID(), actor);
    await assert.rejects(
      postStocktake(db, { ...command, input: { ...command.input, acknowledgeSnapshotBasis: true } }),
      /清单已变化/,
    );
    const fresh = postCommand(await stocktakePreview(db, id));
    fresh.input.acknowledgeSnapshotBasis = true;
    await postStocktake(db, fresh);
    const log = await db.get(
      "SELECT before_json,after_json FROM operation_log WHERE target_id=? AND action='stocktake.snapshot-basis.acknowledge'",
      [id],
    );
    assert.equal(JSON.parse(String(log?.before_json)).unposted.length, 2);
    assert.equal(JSON.parse(String(log?.after_json)).acknowledged, true);
    console.log('B3A_ACK default=409 stale_ack=409 current_ack=200 audit_unposted=2');
  } finally {
    await dispose();
  }
});
test('B3a 零差异需人工完成但不制造流水；空原因422契约、漂移409', async () => {
  const { db, dispose } = await fixture();
  try {
    const preview = await counted(db, { packages: 6, weightGrams: 1800000 }),
      command = postCommand(preview);
    await assert.rejects(postStocktake(db, { ...command, input: { ...command.input, reason: '  ' } }));
    await db.run("UPDATE stock SET packages=7 WHERE warehouse_code='DEMO-WH'");
    await assert.rejects(postStocktake(db, command), /外部修改/);
    await db.run("UPDATE stock SET packages=6 WHERE warehouse_code='DEMO-WH'");
    const after = await postStocktake(db, command);
    assert.equal(after.status, 'completed');
    assert.equal(Number((await db.get('SELECT COUNT(*) AS n FROM stock_journal'))?.n), 0);
    console.log('B3A_ZERO manual_complete=true journals=0 drift_rejected=true');
  } finally {
    await dispose();
  }
});
