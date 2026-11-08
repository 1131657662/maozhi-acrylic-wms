import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { catalogFixture, fact, catalogSnapshot } from './catalog-fixture.ts';
import { createApp } from '../src/app.ts';

const origin = 'http://127.0.0.1:5173';
test('目录 HTTP：鉴权、空快照、旧协议计数持久门禁', async () => {
  const { db, dispose } = await catalogFixture();
  try {
    const app = createApp(db, [origin], true),
      web = request.agent(app);
    await web
      .post('/api/v1/auth/login')
      .send({ username: 'owner', password: 'test-only-password', channel: 'web' })
      .expect(200);
    const empty = await web
      .post('/api/v1/catalog/uploads?encoding=utf-8&fileName=sku.txt')
      .set('Origin', origin)
      .set('Idempotency-Key', randomUUID())
      .set('Content-Type', 'application/octet-stream')
      .send(Buffer.alloc(0))
      .expect(200);
    assert.equal(empty.body.data.version.entryCount, 0);
    for (const channel of ['pda', 'miniapp']) {
      const login = await request(app)
        .post('/api/v1/auth/login')
        .send({ username: 'owner', password: 'test-only-password', channel })
        .expect(200);
      const token = String(login.body.data.token),
        before = await catalogSnapshot(db);
      await request(app)
        .post('/api/v1/catalog/uploads?encoding=utf-8&fileName=sku.txt')
        .auth(token, { type: 'bearer' })
        .set('Content-Type', 'application/octet-stream')
        .send('规格 A 300')
        .expect(403);
      await request(app)
        .post('/api/v1/catalog/versions/2/publish')
        .auth(token, { type: 'bearer' })
        .send({})
        .expect(403);
      assert.deepEqual(await catalogSnapshot(db), before);
      if (channel === 'pda')
        await request(app)
          .post('/api/v1/scan/plans/DEMO-001/facts')
          .auth(token, { type: 'bearer' })
          .send(fact())
          .expect(200);
    }
    const gate = (await web.get('/api/v1/catalog').expect(200)).body.data.gate;
    assert.equal(gate.allowed, false);
    assert.equal(gate.legacyRequests, 1);
    const version = empty.body.data.version,
      before = await catalogSnapshot(db);
    const rejected = await web
      .post(`/api/v1/catalog/versions/${version.versionId}/publish`)
      .set('Origin', origin)
      .set('Idempotency-Key', randomUUID())
      .send({ baseRevision: version.baseRevision, contentSha256: version.contentSha256 })
      .expect(409);
    assert.equal(rejected.body.code, 'CATALOG_PUBLISH_BLOCKED');
    assert.deepEqual(await catalogSnapshot(db), before);
    console.log(
      'B1C1_HTTP empty_snapshot=accepted pda_upload_publish=403 miniapp_upload_publish=403 legacy_gate=409 unchanged=true',
    );
  } finally {
    await dispose();
  }
});
