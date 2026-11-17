import { test } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { createApp } from '../src/app.ts';
import { maintenanceHealth } from '../src/features/maintenance/health.ts';
import { outageFixture } from './maintenance-outage-fixture.ts';

test('B8a-1 真实停止独立MySQL后ping异常且健康HTTP安全503，不返回正常', { timeout: 120000 }, async () => {
  const c = await outageFixture();
  try {
    const api = request.agent(createApp(c.db));
    await api
      .post('/api/v1/auth/login')
      .set('Origin', 'http://127.0.0.1:5173')
      .send({ username: 'owner', password: 'maintenance-outage-test', channel: 'web' })
      .expect(200);
    const before = await api.get('/api/v1/maintenance/health').expect(200);
    assert.equal(before.body.data.database.status, 'ok');
    await c.stop();
    const health = await maintenanceHealth(c.db);
    assert.equal(health.database.status, 'error');
    assert.equal(health.database.latencyMs, null);
    assert.equal(health.backup.status, 'error');
    const response = await api.get('/api/v1/maintenance/health').expect(503);
    assert.equal(response.body.code, 'MAINTENANCE_DATABASE_UNAVAILABLE');
    assert.equal(response.body.data, null);
    assert.match(response.body.message, /数据库连接异常/);
    assert.doesNotMatch(response.text, /ECONN|SELECT |password|"ok"/);
  } finally {
    await c.dispose();
  }
});
