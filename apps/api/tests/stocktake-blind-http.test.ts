import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { publicStocktakeSchema, stocktakeSchema } from '@wms/contracts';
import { origin } from './numbering-fixture.ts';
import { blindFixture, saveBlind, revealBlind, assertNoBook, assertVisibleLine } from './stocktake-blind-fixture.ts';

test('B6e-1 未揭示盲盘逐 HTTP 出口没有账面 key，预览与直接回写拒绝', async () => {
  const c = await blindFixture();
  try {
    assertNoBook(c.creation);
    assert.equal(c.take.mode, 'blind');
    for (const path of ['/api/v1/stocktakes', c.base, `${c.base}/lines`, '/api/v1/stocktakes?status=counting'])
      assertNoBook((await c.web.get(path).expect(200)).body);
    assertNoBook((await saveBlind(c)).body);
    const preview = await c.web.get(`${c.base}/preview`).expect(409);
    assert.equal(preview.body.code, 'STOCKTAKE_NOT_REVEALED');
    assertNoBook(preview.body);
    const rejected = await c.web
      .post(`${c.base}/post`)
      .set('Origin', origin)
      .set('Idempotency-Key', randomUUID())
      .send({ expectedToken: '0'.repeat(64), reason: '绕过揭示' })
      .expect(409);
    assert.equal(rejected.body.code, 'STOCKTAKE_NOT_REVEALED');
    assertNoBook(rejected.body);
    assertNoBook(
      (
        await c.web
          .post(`${c.base}/void`)
          .set('Origin', origin)
          .set('Idempotency-Key', randomUUID())
          .send({ expectedRevision: 1, reason: '保留未揭示记录' })
          .expect(200)
      ).body,
    );
    assertNoBook((await c.web.get(c.base).expect(200)).body);
  } finally {
    await c.dispose();
  }
});

test('B6e-1 揭示后同一查询和保存返回账面，修改读数不撤销揭示但旧回写令牌失效', async () => {
  const c = await blindFixture();
  try {
    await saveBlind(c);
    const revealed = await revealBlind(c);
    assert.equal(revealed.status, 200);
    assertVisibleLine((await c.web.get(`${c.base}/lines`).expect(200)).body.data.items[0]);
    for (const path of ['/api/v1/stocktakes', c.base]) {
      const result = (await c.web.get(path).expect(200)).body.data;
      const take = publicStocktakeSchema.parse(result.items?.[0] ?? result);
      assert.equal(take.visibility, 'visible');
      assert.equal(stocktakeSchema.parse(take).snapshotPackages, 6);
    }
    assertVisibleLine((await saveBlind(c, 1)).body.data);
    const stale = await c.web
      .post(`${c.base}/post`)
      .set('Origin', origin)
      .set('Idempotency-Key', randomUUID())
      .send({ expectedToken: revealed.body.data.token, reason: '旧预览' })
      .expect(409);
    assert.equal(stale.body.code, 'STALE_STOCKTAKE_PREVIEW');
    const fresh = (await c.web.get(`${c.base}/preview`).expect(200)).body.data;
    assert.equal(fresh.stocktake.visibility, 'visible');
    await c.web
      .post(`${c.base}/post`)
      .set('Origin', origin)
      .set('Idempotency-Key', randomUUID())
      .send({ expectedToken: fresh.token, reason: '重新核对后回写' })
      .expect(200);
    assert.equal(
      Number(
        (
          await c.db.get(
            'SELECT COUNT(*) AS n FROM stock_journal WHERE operation_id IN (SELECT operation_id FROM stocktakes WHERE id=?)',
            [c.take.id],
          )
        )?.n,
      ),
      1,
    );
  } finally {
    await c.dispose();
  }
});

test('B6e-1 明盘保留原快照与独立包吨差异，不需要揭示', async () => {
  const c = await blindFixture('open');
  try {
    assert.equal(c.take.visibility, 'visible');
    assert.equal(stocktakeSchema.parse(c.take).snapshotPackages, 6);
    assertVisibleLine((await saveBlind(c)).body.data);
    const preview = (await c.web.get(`${c.base}/preview`).expect(200)).body.data;
    assert.equal(preview.stocktake.packagesDelta, -1);
    assert.equal(preview.stocktake.weightDeltaGrams, -276900);
    assert.equal((await revealBlind(c)).body.code, 'STOCKTAKE_NOT_BLIND');
  } finally {
    await c.dispose();
  }
});
