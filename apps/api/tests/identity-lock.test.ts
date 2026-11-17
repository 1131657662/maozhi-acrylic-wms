import { test } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import bcrypt from 'bcryptjs';
import { createApp } from '../src/app.ts';
import { fixture, actor } from './fixture.ts';
import { identityFixture, currentPassword, nextPassword, identityOrigin as origin } from './identity-fixture.ts';
import { login } from '../src/features/auth/service.ts';
import { changePassword } from '../src/features/auth/account-commands.ts';
import { AUTH_POLICY, passwordRuleError } from '@wms/contracts';
import type { Database } from '../src/db/mysql.ts';

test('B8b五次失败锁15分钟且跨服务持久，锁中不泄露正确性，到期恢复', async (t) => {
  const c = await fixture();
  try {
    const now = Date.now();
    t.mock.method(Date, 'now', () => now);
    for (let i = 0; i < 5; i++)
      await c.api
        .post('/api/v1/auth/login')
        .send({ username: 'owner', password: 'wrong', channel: i % 2 ? 'pda' : 'web' })
        .expect(i === 4 ? 429 : 401);
    const before = await c.db.get('SELECT failed_attempts,locked_until FROM owner');
    assert.equal(before?.failed_attempts, 5);
    const restarted = request(createApp(c.db));
    for (const password of [currentPassword, 'wrong']) {
      const result = await restarted
        .post('/api/v1/auth/login')
        .send({ username: 'owner', password, channel: 'miniapp' })
        .expect(429);
      assert.equal(result.body.code, 'ACCOUNT_LOCKED');
      assert.equal(result.body.data.retryAfterSeconds, 900);
      assert.equal(result.headers['retry-after'], '900');
    }
    assert.deepEqual(await c.db.get('SELECT failed_attempts,locked_until FROM owner'), before);
    t.mock.method(Date, 'now', () => now + AUTH_POLICY.lockMs);
    await restarted
      .post('/api/v1/auth/login')
      .send({ username: 'owner', password: currentPassword, channel: 'pda' })
      .expect(200);
    assert.deepEqual(await c.db.get('SELECT failed_attempts,locked_until FROM owner'), {
      failed_attempts: 0,
      locked_until: null,
    });
    assert.equal(
      Number(
        (
          await c.db.get(
            "SELECT COUNT(*) AS n FROM operation_attempts WHERE result='failed' AND effect_state='not_applied'",
          )
        )?.n,
      ),
      7,
    );
  } finally {
    await c.dispose();
  }
});

test('B8b成功清零，到期后的失败重新从一次计数，并发失败不丢计数', async () => {
  const c = await fixture();
  try {
    await c.db.run('UPDATE owner SET failed_attempts=4');
    await login(c.db, { username: 'owner', password: currentPassword, channel: 'web' }, actor);
    assert.equal((await c.db.get('SELECT failed_attempts FROM owner'))?.failed_attempts, 0);
    await c.db.run("UPDATE owner SET failed_attempts=5,locked_until='2020-01-01'");
    await assert.rejects(login(c.db, { username: 'owner', password: 'wrong', channel: 'web' }, actor), /用户名或密码/);
    assert.equal((await c.db.get('SELECT failed_attempts FROM owner'))?.failed_attempts, 1);
    const results = await Promise.allSettled(
      Array.from({ length: 4 }, () => login(c.db, { username: 'owner', password: 'wrong', channel: 'pda' }, actor)),
    );
    assert.ok(results.every((r) => r.status === 'rejected'));
    assert.equal((await c.db.get('SELECT failed_attempts FROM owner'))?.failed_attempts, 5);
  } finally {
    await c.dispose();
  }
});

test('B8b旧密码已比较的登录在改密提交后不得签发', async (t) => {
  const c = await identityFixture();
  try {
    const transaction = c.db.transaction.bind(c.db);
    let notify!: () => void, resume!: () => void;
    const entered = new Promise<void>((resolve) => {
      notify = resolve;
    });
    const release = new Promise<void>((resolve) => {
      resume = resolve;
    });
    const gate = t.mock.method(
      c.db,
      'transaction',
      async <T>(work: (tx: Database) => Promise<T>) => {
        notify();
        await release;
        return transaction(work);
      },
      { times: 1 },
    );
    const pending = login(c.db, { username: 'owner', password: currentPassword, channel: 'pda' }, actor);
    const rejection = assert.rejects(pending, /用户名或密码/);
    await entered;
    gate.mock.restore();
    try {
      await changePassword(c.db, { token: c.token, actor, oldPassword: currentPassword, newPassword: nextPassword });
    } finally {
      resume();
    }
    await rejection;
    assert.equal(Number((await c.db.get('SELECT COUNT(*) AS n FROM sessions'))?.n), 0);
  } finally {
    await c.dispose();
  }
});

test('B8b新密码按UTF-8字节边界校验，旧超长允许登录提示并改密', async () => {
  const c = await identityFixture();
  try {
    assert.equal(passwordRuleError('A1' + 'x'.repeat(70)), null);
    assert.equal(passwordRuleError('腈'.repeat(3) + 'A12'), null);
    for (const password of ['a1', 'a'.repeat(12), '1'.repeat(12), 'A1' + 'x'.repeat(71), '腈'.repeat(24) + 'A1'])
      await c.web
        .post('/api/v1/me/password')
        .set('Origin', origin)
        .send({ oldPassword: currentPassword, newPassword: password })
        .expect(422);
    const legacy = 'A'.repeat(72) + 'legacy1';
    await c.db.run('UPDATE owner SET password_hash=?', [await bcrypt.hash(legacy, 4)]);
    const result = await c.web
      .post('/api/v1/auth/login')
      .send({ username: 'owner', password: legacy, channel: 'web' })
      .expect(200);
    assert.equal(result.body.data.passwordChangeRecommended, true);
    assert.match(result.body.message, /修改密码/);
    await c.web
      .post('/api/v1/me/password')
      .set('Origin', origin)
      .send({ oldPassword: legacy, newPassword: nextPassword })
      .expect(200);
  } finally {
    await c.dispose();
  }
});
