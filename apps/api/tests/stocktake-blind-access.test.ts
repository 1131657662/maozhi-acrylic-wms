import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { numberingFixture, origin } from './numbering-fixture.ts';
import { blindFixture, assertNoBook } from './stocktake-blind-fixture.ts';

test('B6e-1 揭示与导出要求Web登录，揭示还须同源和有效版本', async () => {
  const c = await blindFixture();
  try {
    const paths = [`/api/v1/stocktake/${c.take.id}/reveal`, `${c.base}/reveal`];
    for (const path of paths) await c.api.post(path).send({}).expect(401);
    await c.api.get(`${c.base}/export`).expect(401);
    for (const channel of ['pda', 'miniapp']) {
      const login = await c.api
        .post('/api/v1/auth/login')
        .send({ username: 'owner', password: 'test-only-password', channel })
        .expect(200);
      for (const path of paths)
        await c.api.post(path).auth(login.body.data.token, { type: 'bearer' }).send({}).expect(403);
      await c.api.get(`${c.base}/export`).auth(login.body.data.token, { type: 'bearer' }).expect(403);
    }
    await c.web.post(paths[0]!).set('Origin', 'https://invalid.example').send({ expectedRevision: 0 }).expect(403);
    for (const body of [{}, { expectedRevision: -1 }, { expectedRevision: 0, revealedAt: 'forged' }]) {
      assertNoBook(
        (await c.web.post(paths[0]!).set('Origin', origin).set('Idempotency-Key', randomUUID()).send(body).expect(422))
          .body,
      );
    }
    assertNoBook((await c.web.get(c.base).expect(200)).body);
  } finally {
    await c.dispose();
  }
});

test('B6e-1 创建缺省明盘，显式open以原键重放，模式不可在重试中改变', async () => {
  const c = await numberingFixture();
  try {
    const key = randomUUID();
    const create = (mode?: 'open' | 'blind') =>
      c.web
        .post('/api/v1/stocktakes')
        .set('Origin', origin)
        .set('Idempotency-Key', key)
        .send({ warehouseCode: 'DEMO-WH', ...(mode ? { mode } : {}) });
    const initial = await create().expect(200);
    assert.equal(initial.body.data.mode, 'open');
    assert.equal(initial.body.data.snapshotPackages, 6);
    assert.deepEqual((await create('open').expect(200)).body.data, initial.body.data);
    assert.equal((await create('blind').expect(409)).body.code, 'IDEMPOTENCY_CONFLICT');
  } finally {
    await c.dispose();
  }
});
