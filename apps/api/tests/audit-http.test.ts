import { test } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { randomUUID } from 'node:crypto';
import { numberingFixture, origin } from './numbering-fixture.ts';

test('B6c-1 authentication failures and invalid JSON retain evidence with untrusted identity unset', async () => {
  const c = await numberingFixture();
  try {
    const login = await c.api
      .post('/api/v1/auth/login')
      .set('X-Channel', 'pda')
      .send({
        username: 'owner',
        password: 'do-not-store',
        channel: 'pda',
      })
      .expect(401);
    const row = await c.db.get('SELECT * FROM operation_attempts WHERE trace_id=?', [login.body.traceId]);
    assert.equal(row?.actor, null);
    assert.equal(row?.channel, null);
    assert.deepEqual(row?.input_summary, { claimedUsername: 'owner' });
    assert.doesNotMatch(JSON.stringify(row), /do-not-store/);
    const unauth = await request(c.app).post('/api/v1/inbound').set('Origin', origin).send({}).expect(401);
    const untrusted = await c.db.get('SELECT actor,channel FROM operation_attempts WHERE trace_id=?', [
      unauth.body.traceId,
    ]);
    assert.deepEqual(untrusted, { actor: null, channel: 'web' });
    const invalid = await c.web
      .post('/api/v1/inbound')
      .set('Origin', origin)
      .set('Content-Type', 'application/json')
      .send('{"password":"never-store"')
      .expect(422);
    const invalidRow = await c.db.get('SELECT input_summary FROM operation_attempts WHERE trace_id=?', [
      invalid.body.traceId,
    ]);
    assert.deepEqual(invalidRow?.input_summary, {});
  } finally {
    await c.dispose();
  }
});

test('B6c-1 verified token channel wins over forged headers and wrong-channel routes retain failures', async () => {
  const c = await numberingFixture();
  try {
    const pda = await c.api
      .post('/api/v1/auth/login')
      .send({ username: 'owner', password: 'test-only-password', channel: 'pda' })
      .expect(200);
    const forbidden = await c.api
      .post('/api/v1/inbound')
      .set('Authorization', `Bearer ${pda.body.data.token}`)
      .set('X-Channel', 'web')
      .set('Origin', origin)
      .send({})
      .expect(403);
    const row = await c.db.get('SELECT actor,channel FROM operation_attempts WHERE trace_id=?', [
      forbidden.body.traceId,
    ]);
    assert.deepEqual(row, { actor: 'owner', channel: 'pda' });
    const bad = await c.web
      .post('/api/v1/inbound')
      .set('Origin', origin)
      .set('X-Channel', 'pda')
      .set('X-Request-Id', 'forged-trace')
      .set('Idempotency-Key', randomUUID())
      .send({
        warehouseCode: 'DEMO-WH',
        lines: [],
        password: 'secret',
        nested: '{"token":"secret"}',
      })
      .expect(422);
    const evidence = await c.db.get('SELECT * FROM operation_attempts WHERE trace_id=?', [bad.body.traceId]);
    assert.equal(evidence?.channel, 'web');
    assert.notEqual(evidence?.trace_id, 'forged-trace');
    assert.deepEqual(evidence?.input_summary, { warehouseCode: 'DEMO-WH', linesCount: 0 });
    assert.doesNotMatch(JSON.stringify(evidence), /secret/);
    console.log('B6C1_CHANNEL trusted_token=pda forged_web_header_ignored=true input=allowlist_only');
  } finally {
    await c.dispose();
  }
});
