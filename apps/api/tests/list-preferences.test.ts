import { test } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { numberingFixture, origin } from './numbering-fixture.ts';
import { WEB_LIST_VIEW_SCHEMA_VERSION } from '@wms/contracts';

const path = '/api/v1/me/list-preferences/inbound';
const settings = {
  schemaVersion: WEB_LIST_VIEW_SCHEMA_VERSION,
  columns: { receiptNo: { width: 320 }, packages: { show: false, order: 3 } },
};

test('列偏好按登录身份/页面隔离，同一 PUT 重放保持一行，空值重置留标记', async () => {
  const c = await numberingFixture();
  try {
    const empty = await c.web.get(path).expect(200);
    assert.deepEqual(empty.body.data.columns, {});
    assert.equal(empty.body.data.updatedAt, null);
    for (let i = 0; i < 2; i++) await c.web.put(path).set('Origin', origin).send(settings).expect(200);
    assert.deepEqual((await c.web.get(path)).body.data.columns, settings.columns);
    assert.equal(Number((await c.db.get('SELECT COUNT(*) AS n FROM user_list_preferences'))?.n), 1);
    assert.deepEqual((await c.web.get('/api/v1/me/list-preferences/outbound')).body.data.columns, {});
    await c.db.run(
      "INSERT INTO owner(username,password_hash) SELECT 'other',password_hash FROM owner WHERE username='owner'",
    );
    const other = request.agent(c.app);
    await other
      .post('/api/v1/auth/login')
      .send({ username: 'other', password: 'test-only-password', channel: 'web' })
      .expect(200);
    assert.deepEqual((await other.get(path).expect(200)).body.data.columns, {});
    await other
      .put(path)
      .set('Origin', origin)
      .send({ ...settings, columns: { receiptNo: { width: 480 } } })
      .expect(200);
    assert.equal((await c.web.get(path)).body.data.columns.receiptNo.width, 320);
    const reset = await c.web
      .put(path)
      .set('Origin', origin)
      .send({ ...settings, columns: {} })
      .expect(200);
    assert.deepEqual(reset.body.data.columns, {});
    assert.ok(reset.body.data.updatedAt);
    assert.equal(Number((await c.db.get('SELECT COUNT(*) AS n FROM user_list_preferences'))?.n), 2);
  } finally {
    await c.dispose();
  }
});

test('列偏好拒绝伪造身份、越界宽度/版本/未知字段；Web 同源与登录门禁', async () => {
  const c = await numberingFixture();
  try {
    await c.api.get(path).expect(401);
    await c.web.put(path).send(settings).expect(403);
    const pda = await c.api
      .post('/api/v1/auth/login')
      .send({ username: 'owner', password: 'test-only-password', channel: 'pda' });
    await c.api.get(path).auth(pda.body.data.token, { type: 'bearer' }).expect(403);
    for (const body of [
      { ...settings, userId: 'other' },
      { ...settings, schemaVersion: WEB_LIST_VIEW_SCHEMA_VERSION + 1 },
      { ...settings, columns: { receiptNo: { width: 79 } } },
      { ...settings, columns: { receiptNo: { width: 601 } } },
      { ...settings, columns: { receiptNo: { raw: 'private' } } },
    ])
      await c.web.put(path).set('Origin', origin).send(body).expect(422);
    await c.web.get(path).query({ userId: 'other' }).expect(422);
    await c.web.get('/api/v1/me/list-preferences/unknown').expect(422);
    assert.equal(Number((await c.db.get('SELECT COUNT(*) AS n FROM user_list_preferences'))?.n), 0);
  } finally {
    await c.dispose();
  }
});

test('旧 schema 按列 key 保留偏好并丢弃未知列，新增列由客户端默认合并', async () => {
  const c = await numberingFixture();
  try {
    const response = await c.web
      .put(path)
      .set('Origin', origin)
      .send({
        schemaVersion: 0,
        columns: {
          receiptNo: { width: 360 },
          packages: { show: false, order: 4 },
          retiredColumn: { width: 580 },
        },
      })
      .expect(200);
    assert.equal(response.body.data.schemaVersion, WEB_LIST_VIEW_SCHEMA_VERSION);
    assert.deepEqual(response.body.data.columns, { receiptNo: { width: 360 }, packages: { show: false, order: 4 } });
    await c.db.run('UPDATE user_list_preferences SET schema_version=0');
    assert.deepEqual((await c.web.get(path).expect(200)).body.data.columns, response.body.data.columns);
  } finally {
    await c.dispose();
  }
});
