import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { discoveryFixture, addDiscovery, discoveryInput } from './stocktake-discovery-fixture.ts';
import { createDiscovery, updateDiscovery, deleteDiscovery } from '../src/features/stocktake/discovery-command.ts';
import { stocktakePreview } from '../src/features/stocktake/preview.ts';
import { postStocktake } from '../src/features/stocktake/post.ts';
import { businessFingerprint } from './lifecycle-fixture.ts';
import { postCommand, injectStocktakeFailure } from './stocktake-fixture.ts';
import { actor } from './fixture.ts';

test('B6e-2 回写各阶段故障回滚普通差异、发现库存、流水、终态与幂等', async () => {
  const c = await discoveryFixture();
  try {
    await addDiscovery(c).expect(200);
    const command = postCommand(await stocktakePreview(c.db, c.take.id));
    const before = await businessFingerprint(c.db);
    const stages: [string, 'INSERT' | 'UPDATE', string][] = [
      ['stock', 'INSERT', "NEW.product_code='DISC-001'"],
      ['stock_journal', 'INSERT', "NEW.product_code='DISC-001'"],
      ['stocktakes', 'UPDATE', "NEW.status='completed'"],
      ['stocktake_windows', 'UPDATE', '1'],
      ['operation_log', 'INSERT', "NEW.action='stocktake.post'"],
      ['idempotent_commands', 'INSERT', '1'],
    ];
    for (const [table, event, condition] of stages) {
      await injectStocktakeFailure(c.db, table, event, condition);
      try {
        await assert.rejects(postStocktake(c.db, command), /injected failure/);
        assert.deepEqual(await businessFingerprint(c.db), before, table);
      } finally {
        await c.db.run('DROP TRIGGER b3a_fail');
      }
    }
    assert.equal((await postStocktake(c.db, command)).status, 'completed');
  } finally {
    await c.dispose();
  }
});
test('B6e-2 发现行增改删的审计失败不留下半条变更', async () => {
  const c = await discoveryFixture();
  try {
    const create = { id: c.take.id, input: discoveryInput, key: randomUUID(), actor };
    const before = await businessFingerprint(c.db);
    await injectStocktakeFailure(c.db, 'operation_log', 'INSERT');
    try {
      await assert.rejects(createDiscovery(c.db, create), /injected/);
      assert.deepEqual(await businessFingerprint(c.db), before);
    } finally {
      await c.db.run('DROP TRIGGER b3a_fail');
    }
    const line = await createDiscovery(c.db, create);
    const saved = await businessFingerprint(c.db);
    await injectStocktakeFailure(c.db, 'operation_log', 'INSERT');
    try {
      await assert.rejects(
        updateDiscovery(c.db, {
          ...create,
          key: randomUUID(),
          lineId: line.id,
          input: { version: 0, packages: 4, weightGrams: 812300, reason: '复核' },
        }),
        /injected/,
      );
      await assert.rejects(
        deleteDiscovery(c.db, { ...create, key: randomUUID(), lineId: line.id, input: { version: 0 } }),
        /injected/,
      );
      assert.deepEqual(await businessFingerprint(c.db), saved);
    } finally {
      await c.db.run('DROP TRIGGER b3a_fail');
    }
  } finally {
    await c.dispose();
  }
});
test('B6e-2 登记后账面漂移或商品失效阻断回写，刷新预览不能绕过', async () => {
  const c = await discoveryFixture();
  try {
    await addDiscovery(c).expect(200);
    await c.db.run(
      "INSERT INTO stock(warehouse_code,product_code,packages,weight_tonnes) VALUES('DEMO-WH','DISC-001',1,0.3000)",
    );
    await assert.rejects(postStocktake(c.db, postCommand(await stocktakePreview(c.db, c.take.id))), {
      code: 'DISCOVERY_POSTING_INVALID',
    });
    await c.db.run("UPDATE stock SET packages=0,weight_tonnes=0 WHERE product_code='DISC-001'");
    await c.db.run("UPDATE master_products SET active=0 WHERE code='DISC-001'");
    await assert.rejects(postStocktake(c.db, postCommand(await stocktakePreview(c.db, c.take.id))), {
      code: 'DISCOVERY_POSTING_INVALID',
    });
  } finally {
    await c.dispose();
  }
});
test('B6e-2 快照与发现行重叠即阻断，不能重复入账', async () => {
  const c = await discoveryFixture();
  try {
    const line = (await addDiscovery(c).expect(200)).body.data;
    await c.db.run(
      `INSERT INTO stocktake_snapshots(stocktake_id,product_code,product_name,packages,weight_tonnes)
      VALUES(?,'DISC-001','冲突模拟',0,0)`,
      [c.take.id],
    );
    const before = await businessFingerprint(c.db);
    await assert.rejects(postStocktake(c.db, postCommand(await stocktakePreview(c.db, c.take.id))), {
      code: 'DISCOVERY_OVERLAP',
    });
    assert.deepEqual(await businessFingerprint(c.db), before);
    assert.ok(line.id);
  } finally {
    await c.dispose();
  }
});
