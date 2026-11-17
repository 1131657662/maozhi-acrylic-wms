import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { identityFixture, identityOrigin as origin, currentPassword, nextPassword } from './identity-fixture.ts';

test('B8b资料只改显示名，会话列表不返回秘密且仅能撤销本人', async () => {
  const c = await identityFixture();
  try {
    const profile = (await c.web.get('/api/v1/me').expect(200)).body.data;
    assert.equal(profile.username, 'owner');
    assert.equal(profile.lastLoginAt, null);
    await c.web.put('/api/v1/me/profile').set('Origin', origin).send({ displayName: ' 仓管 ' }).expect(200);
    assert.equal((await c.web.get('/api/v1/me')).body.data.displayName, '仓管');
    await c.web
      .put('/api/v1/me/profile')
      .set('Origin', origin)
      .send({ displayName: '伪造', username: 'other' })
      .expect(422);
    const sessions = (await c.web.get('/api/v1/me/sessions').expect(200)).body.data;
    assert.equal(sessions.length, 1);
    assert.equal(sessions[0].isCurrent, true);
    assert.deepEqual(Object.keys(sessions[0]).sort(), ['channel', 'createdAt', 'expiresAt', 'id', 'isCurrent']);
    await c.db.run(
      "INSERT INTO owner(username,password_hash) SELECT 'another',password_hash FROM owner WHERE username='owner'",
    );
    const id = randomUUID();
    await c.db.run(
      `INSERT INTO sessions(token_hash,username,channel,expires_at,id,created_at,epoch)
      VALUES(?,'another','web',?,?,UTC_TIMESTAMP(3),0)`,
      ['b'.repeat(64), Date.now() + 60000, id],
    );
    await c.web.delete(`/api/v1/me/sessions/${id}`).set('Origin', origin).expect(404);
    await c.web.delete(`/api/v1/me/sessions/${randomUUID()}`).set('Origin', origin).expect(404);
    await c.web.delete(`/api/v1/me/sessions/${sessions[0].id}`).set('Origin', origin).expect(200);
    await c.web.get('/api/v1/auth/me').expect(401);
  } finally {
    await c.dispose();
  }
});

test('B8b改密拒绝未登录、错误渠道、Bearer、错误来源及客户端账号', async () => {
  const c = await identityFixture();
  try {
    const body = { oldPassword: currentPassword, newPassword: nextPassword };
    await c.api.post('/api/v1/me/password').set('Origin', origin).send(body).expect(401);
    await c.web.post('/api/v1/me/password').send(body).expect(403);
    await c.web.post('/api/v1/me/password').set('Origin', 'https://invalid.example').send(body).expect(403);
    await c.api
      .post('/api/v1/me/password')
      .auth(c.token, { type: 'bearer' })
      .set('Origin', origin)
      .send(body)
      .expect(403);
    for (const channel of ['pda', 'miniapp']) {
      const login = await c.api
        .post('/api/v1/auth/login')
        .send({ username: 'owner', password: currentPassword, channel })
        .expect(200);
      await c.api
        .post('/api/v1/me/password')
        .auth(login.body.data.token, { type: 'bearer' })
        .set('Origin', origin)
        .send(body)
        .expect(403);
    }
    await c.web
      .post('/api/v1/me/password')
      .set('Origin', origin)
      .send({ ...body, username: 'owner' })
      .expect(422);
    await c.web
      .post('/api/v1/me/password')
      .set('Origin', origin)
      .send({ ...body, oldPassword: 'wrong' })
      .expect(422);
    assert.equal((await c.db.get('SELECT auth_epoch FROM owner'))?.auth_epoch, 0);
  } finally {
    await c.dispose();
  }
});

test('B8b改密后Web/PDA/小程序旧凭据全401，新密码可登录且审计无秘密', async () => {
  const c = await identityFixture();
  try {
    const tokens = [c.token];
    for (const channel of ['pda', 'miniapp']) {
      const r = await c.api
        .post('/api/v1/auth/login')
        .send({ username: 'owner', password: currentPassword, channel })
        .expect(200);
      tokens.push(r.body.data.token);
    }
    const before = await c.db.get('SELECT password_hash FROM owner');
    const result = await c.web
      .post('/api/v1/me/password')
      .set('Origin', origin)
      .send({ oldPassword: currentPassword, newPassword: nextPassword })
      .expect(200);
    assert.match(String(result.headers['set-cookie']), /wms_session=;/);
    for (const token of tokens) await c.api.get('/api/v1/auth/me').auth(token, { type: 'bearer' }).expect(401);
    assert.equal(Number((await c.db.get('SELECT COUNT(*) AS n FROM sessions'))?.n), 0);
    const owner = await c.db.get('SELECT * FROM owner');
    assert.equal(owner?.auth_epoch, 1);
    assert.ok(owner?.password_changed_at);
    await c.web
      .post('/api/v1/auth/login')
      .send({ username: 'owner', password: nextPassword, channel: 'web' })
      .expect(200);
    const evidence = JSON.stringify([
      await c.db.all('SELECT * FROM operation_log'),
      await c.db.all('SELECT * FROM operation_attempts'),
    ]);
    for (const secret of [
      ...tokens,
      currentPassword,
      nextPassword,
      String(before?.password_hash),
      String(owner?.password_hash),
    ])
      assert.ok(!evidence.includes(secret));
    assert.equal(
      Number((await c.db.get("SELECT COUNT(*) AS n FROM operation_log WHERE action='auth.password'"))?.n),
      1,
    );
  } finally {
    await c.dispose();
  }
});

test('B8b并发两次改密仅成功一次', async () => {
  const c = await identityFixture();
  try {
    const responses = await Promise.all(
      [nextPassword, 'Another-safe-password-234'].map((newPassword) =>
        c.web.post('/api/v1/me/password').set('Origin', origin).send({ oldPassword: currentPassword, newPassword }),
      ),
    );
    assert.deepEqual(responses.map((r) => r.status).sort(), [200, 401]);
    assert.equal((await c.db.get('SELECT auth_epoch FROM owner'))?.auth_epoch, 1);
    assert.equal(
      Number((await c.db.get("SELECT COUNT(*) AS n FROM operation_log WHERE action='auth.password'"))?.n),
      1,
    );
  } finally {
    await c.dispose();
  }
});

test('B8b成功审计失败时改密与撤销全部回滚', async () => {
  const c = await identityFixture();
  try {
    const before = await c.db.get('SELECT * FROM owner');
    await c.db.run(`CREATE TRIGGER identity_fail BEFORE INSERT ON operation_log FOR EACH ROW
      SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='synthetic audit failure'`);
    await c.web
      .post('/api/v1/me/password')
      .set('Origin', origin)
      .send({ oldPassword: currentPassword, newPassword: nextPassword })
      .expect(500);
    assert.deepEqual(await c.db.get('SELECT * FROM owner'), before);
    await c.web.get('/api/v1/auth/me').expect(200);
  } finally {
    await c.dispose();
  }
});

test('B8b撤销其他会话保留当前会话，logout兼容别名有效', async () => {
  const c = await identityFixture();
  try {
    const login = await c.api
      .post('/api/v1/auth/login')
      .send({ username: 'owner', password: currentPassword, channel: 'pda' });
    const rows = (await c.web.get('/api/v1/me/sessions')).body.data;
    const other = rows.find((row: { isCurrent: boolean }) => !row.isCurrent);
    await c.web.delete(`/api/v1/me/sessions/${other.id}`).set('Origin', origin).expect(200);
    await c.api.get('/api/v1/auth/me').auth(login.body.data.token, { type: 'bearer' }).expect(401);
    await c.web.get('/api/v1/me').expect(200);
    await c.web.post('/api/v1/me/logout').set('Origin', origin).expect(200);
    await c.web.get('/api/v1/me').expect(401);
  } finally {
    await c.dispose();
  }
});
