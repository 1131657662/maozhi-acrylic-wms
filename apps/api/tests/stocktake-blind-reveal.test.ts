import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { origin } from './numbering-fixture.ts';
import { blindFixture, saveBlind, revealBlind, assertNoBook } from './stocktake-blind-fixture.ts';
import { injectStocktakeFailure } from './stocktake-fixture.ts';
import { businessFingerprint } from './lifecycle-fixture.ts';

test('B6e-1 揭示审计及全部审计出口不携带账面，保留实盘前后值', async () => {
  const c = await blindFixture();
  try {
    await saveBlind(c);
    const before = await c.db.all('SELECT * FROM stock');
    const journal = await c.db.all('SELECT * FROM stock_journal');
    assert.equal((await revealBlind(c)).status, 200);
    assert.deepEqual(await c.db.all('SELECT * FROM stock'), before);
    assert.deepEqual(await c.db.all('SELECT * FROM stock_journal'), journal);
    const logs = await c.db.all('SELECT * FROM operation_log WHERE target_id=?', [c.take.id]);
    assert.equal(logs.filter((row) => row.action === 'stocktake.reveal').length, 1);
    for (const log of logs) {
      assertNoBook(log);
      for (const suffix of ['', '/raw', '/trace.json', '/related'])
        assertNoBook((await c.web.get(`/api/v1/audit/event:${log.id}${suffix}`).expect(200)).body);
    }
    assertNoBook((await c.web.get('/api/v1/web/lists/audit').query({ target: c.take.number }).expect(200)).body);
    assertNoBook((await c.web.get(`/api/v1/audit/objects/stocktake/${c.take.id}`).expect(200)).body);
    assert.ok(await c.db.get('SELECT stocktake_id FROM stocktake_windows WHERE active_warehouse=?', ['DEMO-WH']));
  } finally {
    await c.dispose();
  }
});

test('B6e-1 并发揭示仅一次，原键重放与异正文冲突，两路由共用幂等', async () => {
  const c = await blindFixture();
  try {
    await saveBlind(c);
    const key = randomUUID();
    const responses = await Promise.all(Array.from({ length: 5 }, () => revealBlind(c, 1, key)));
    for (const response of responses) {
      assert.equal(response.status, 200);
      assert.deepEqual(response.body.data, responses[0]!.body.data);
    }
    const alias = await c.web
      .post(`${c.base}/reveal`)
      .set('Origin', origin)
      .set('Idempotency-Key', key)
      .send({ expectedRevision: 1 })
      .expect(200);
    assert.deepEqual(alias.body.data, responses[0]!.body.data);
    assert.equal((await revealBlind(c, 2, key)).body.code, 'IDEMPOTENCY_CONFLICT');
    assert.equal((await revealBlind(c, 2)).body.code, 'STOCKTAKE_ALREADY_REVEALED');
    assert.equal(
      Number(
        (
          await c.db.get("SELECT COUNT(*) AS n FROM operation_log WHERE action='stocktake.reveal' AND target_id=?", [
            c.take.id,
          ])
        )?.n,
      ),
      1,
    );
  } finally {
    await c.dispose();
  }
});

test('B6e-1 未录完、版本过期和揭示审计失败不改变可见性，原键可重试', async () => {
  const c = await blindFixture();
  try {
    assert.equal((await revealBlind(c, 0)).body.code, 'STOCKTAKE_INCOMPLETE');
    await saveBlind(c);
    assert.equal((await revealBlind(c, 0)).body.code, 'STALE_STOCKTAKE');
    const key = randomUUID(),
      before = await businessFingerprint(c.db);
    await injectStocktakeFailure(c.db, 'operation_log', 'INSERT');
    try {
      assert.equal((await revealBlind(c, 1, key)).status, 500);
    } finally {
      await c.db.run('DROP TRIGGER b3a_fail');
    }
    // HTTP failure attempts are intentionally retained separately from the rolled-back business transaction.
    const after = await businessFingerprint(c.db);
    for (const table of Object.keys(before).filter((name) => name !== 'operation_attempts'))
      assert.equal(after[table], before[table], table);
    assertNoBook((await c.web.get(c.base).expect(200)).body);
    assert.equal((await revealBlind(c, 1, key)).status, 200);
  } finally {
    await c.dispose();
  }
});
