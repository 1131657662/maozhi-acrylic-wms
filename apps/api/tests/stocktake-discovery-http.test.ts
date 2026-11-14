import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { discoveryCopy } from '@wms/contracts';
import {
  discoveryFixture,
  addDiscovery,
  editDiscovery,
  removeDiscovery,
  discoveryInput,
} from './stocktake-discovery-fixture.ts';
import { stocktakePreview } from '../src/features/stocktake/preview.ts';
import { postStocktake } from '../src/features/stocktake/post.ts';
import { postCommand } from './stocktake-fixture.ts';
import { origin } from './numbering-fixture.ts';

test('B6e-2 发现差异以零为基数，与普通差异同操作入账且快照不变', async () => {
  const c = await discoveryFixture();
  try {
    const snapshot = await c.db.all('SELECT * FROM stocktake_snapshots WHERE stocktake_id=?', [c.take.id]);
    const line = (await addDiscovery(c).expect(200)).body.data;
    const detail = (await c.web.get(c.detail).expect(200)).body.data;
    assert.equal(detail.discoveries.items[0].id, line.id);
    assert.equal(detail.lineCount, 2);
    const lines = (await c.web.get(`${c.detail}/lines`).expect(200)).body.data.items;
    const found = lines.find((r: { productCode: string }) => r.productCode === discoveryInput.productCode);
    assert.deepEqual(found.snapshot, { packages: 0, weightGrams: 0 });
    assert.equal(found.packagesDelta, discoveryInput.packages);
    assert.equal(found.weightDeltaGrams, discoveryInput.weightGrams);
    const preview = await stocktakePreview(c.db, c.take.id);
    assert.equal(preview.stocktake.changedCount, 2);
    assert.equal(preview.stocktake.packagesDelta, 2);
    assert.equal(preview.stocktake.weightDeltaGrams, 512300);
    const command = postCommand(preview);
    const result = await postStocktake(c.db, command);
    assert.deepEqual(await postStocktake(c.db, command), result);
    assert.equal(result.status, 'completed');
    assert.deepEqual(await c.db.get("SELECT packages,weight_tonnes FROM stock WHERE product_code='DISC-001'"), {
      packages: 3,
      weight_tonnes: '0.8123',
    });
    const journals = await c.db.all('SELECT * FROM stock_journal WHERE operation_id=? ORDER BY product_code', [
      result.operationId,
    ]);
    assert.equal(journals.length, 2);
    assert.equal(journals[1]!.packages_before, 0);
    assert.equal(journals[1]!.packages_after, 3);
    assert.deepEqual(await c.db.all('SELECT * FROM stocktake_snapshots WHERE stocktake_id=?', [c.take.id]), snapshot);
  } finally {
    await c.dispose();
  }
});
test('B6e-2 快照内、当前非零与同单重复商品分别422', async () => {
  const c = await discoveryFixture();
  try {
    assert.equal(
      (await addDiscovery(c, { ...discoveryInput, productCode: 'ACR-032' }).expect(422)).body.code,
      'DISCOVERY_IN_SNAPSHOT',
    );
    await c.db.run(
      "INSERT INTO stock(warehouse_code,product_code,packages,weight_tonnes) VALUES('DEMO-WH','DISC-001',0,0.0001)",
    );
    assert.equal((await addDiscovery(c).expect(422)).body.message, discoveryCopy.existingStock);
    await c.db.run("UPDATE stock SET weight_tonnes=0,packages=1 WHERE product_code='DISC-001'");
    assert.equal((await addDiscovery(c).expect(422)).body.code, 'DISCOVERY_STOCK_EXISTS');
    await c.db.run("UPDATE stock SET packages=0 WHERE product_code='DISC-001'");
    await addDiscovery(c).expect(200);
    assert.equal((await addDiscovery(c).expect(422)).body.code, 'DISCOVERY_DUPLICATE');
  } finally {
    await c.dispose();
  }
});
test('B6e-2 同键并发只登记一次，异键重复拒绝且不重复审计', async () => {
  const c = await discoveryFixture();
  try {
    const key = randomUUID();
    const [a, b] = await Promise.all([addDiscovery(c, discoveryInput, key), addDiscovery(c, discoveryInput, key)]);
    assert.equal(a.status, 200);
    assert.equal(b.status, 200);
    assert.deepEqual(a.body.data, b.body.data);
    await addDiscovery(c, { ...discoveryInput, packages: 9 }, key).expect(409);
    await addDiscovery(c).expect(422);
    assert.equal(
      Number((await c.db.get("SELECT COUNT(*) AS n FROM operation_log WHERE action='stocktake.discovery.create'"))?.n),
      1,
    );
    assert.equal(Number((await c.db.get('SELECT COUNT(*) AS n FROM stocktake_discovery_lines'))?.n), 1);
  } finally {
    await c.dispose();
  }
});
test('B6e-2 修改原因或删除发现行使旧令牌失效，过期版本不覆盖', async () => {
  const c = await discoveryFixture();
  try {
    const line = (await addDiscovery(c).expect(200)).body.data;
    const before = postCommand(await stocktakePreview(c.db, c.take.id));
    await editDiscovery(c, line.id, 0, 3).expect(200);
    await editDiscovery(c, line.id, 0).expect(409);
    await removeDiscovery(c, line.id, 0).expect(409);
    await assert.rejects(postStocktake(c.db, before), { code: 'STALE_STOCKTAKE_PREVIEW' });
    const afterEdit = postCommand(await stocktakePreview(c.db, c.take.id));
    const key = randomUUID();
    const removed = (await removeDiscovery(c, line.id, 1, key).expect(200)).body.data;
    assert.deepEqual((await removeDiscovery(c, line.id, 1, key).expect(200)).body.data, removed);
    await assert.rejects(postStocktake(c.db, afterEdit), { code: 'STALE_STOCKTAKE_PREVIEW' });
    assert.equal(
      Number((await c.db.get("SELECT COUNT(*) AS n FROM operation_log WHERE action='stocktake.discovery.delete'"))?.n),
      1,
    );
    await addDiscovery(c).expect(200);
  } finally {
    await c.dispose();
  }
});
test('B6e-2 回写后发现行拒绝增改删，数据库也拒绝终态篡改', async () => {
  const c = await discoveryFixture();
  try {
    const line = (await addDiscovery(c).expect(200)).body.data;
    await postStocktake(c.db, postCommand(await stocktakePreview(c.db, c.take.id)));
    await editDiscovery(c, line.id).expect(409);
    await removeDiscovery(c, line.id).expect(409);
    await addDiscovery(c).expect(409);
    await assert.rejects(
      c.db.run('UPDATE stocktake_discovery_lines SET packages=9,version=version+1 WHERE id=?', [line.id]),
      /closed/,
    );
    await assert.rejects(c.db.run('DELETE FROM stocktake_discovery_lines WHERE id=?', [line.id]), /immutable/);
    assert.equal((await c.web.get(c.detail).expect(200)).body.data.discoveries.items[0].packages, 3);
  } finally {
    await c.dispose();
  }
});
test('B6e-2 登录/同源/参数与跨单行边界均拒绝', async () => {
  const c = await discoveryFixture();
  try {
    await c.api.post(c.base).send(discoveryInput).expect(401);
    await c.web.post(c.base).set('Origin', 'https://bad.invalid').send(discoveryInput).expect(403);
    for (const input of [
      { ...discoveryInput, weightGrams: undefined },
      { ...discoveryInput, reason: ' ' },
      { ...discoveryInput, weightGrams: 1 },
      { ...discoveryInput, packages: -1 },
      { ...discoveryInput, packages: 0.5 },
    ])
      await c.web.post(c.base).set('Origin', origin).set('Idempotency-Key', randomUUID()).send(input).expect(422);
    const line = (await addDiscovery(c).expect(200)).body.data;
    await editDiscovery(c, randomUUID()).expect(409);
    await c.web
      .patch(`/api/v1/stocktake/${randomUUID()}/discoveries/${line.id}`)
      .set('Origin', origin)
      .set('Idempotency-Key', randomUUID())
      .send({ version: 0, packages: 1, weightGrams: 100, reason: '跨单' })
      .expect(409);
  } finally {
    await c.dispose();
  }
});
