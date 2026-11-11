import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { auditQueryFixture } from './audit-query-fixture.ts';
import { audit } from '../src/shared/audit.ts';
import { actor } from './fixture.ts';

test('B6c-2 timeline pages 20 objects before batch loading events and separates equal IDs across kinds', async () => {
  const c = await auditQueryFixture(1);
  try {
    for (let index = 0; index < 21; index++)
      await audit(
        c.db,
        { ...actor, traceId: randomUUID(), channel: 'web' },
        {
          action: index === 20 ? 'outbound.confirm' : 'inbound.confirm',
          targetId: index === 20 ? c.target : randomUUID(),
          before: null,
          after: { receiptNo: `对象-${index}`, orderNo: `对象-${index}` },
        },
      );
    const first = await c.web.get('/api/v1/audit/timeline').query({ action: '确认' }).expect(200);
    const second = await c.web.get('/api/v1/audit/timeline').query({ action: '确认', page: 2 }).expect(200);
    assert.equal(first.body.data.items.length, 20);
    assert.equal(second.body.data.items.length, 2);
    const groups = [...first.body.data.items, ...second.body.data.items];
    assert.equal(new Set(groups.map((row) => row.id)).size, 22);
    const incoming = await c.web.get(`/api/v1/audit/objects/inbound/${c.target}`).expect(200);
    const outgoing = await c.web.get(`/api/v1/audit/objects/outbound/${c.target}`).expect(200);
    assert.equal(incoming.body.data.total, 2);
    assert.equal(outgoing.body.data.total, 1);
    console.log('B6C2_OBJECTS groups=22 page1=20 page2=2 same_id_different_kind=isolated');
  } finally {
    await c.dispose();
  }
});

test('B6c-2 defaults to seven calendar days and explicit dates can retrieve older events', async () => {
  const c = await auditQueryFixture(1);
  try {
    await c.db.run("UPDATE operation_log SET created_at='2020-01-01 00:00:00' WHERE id=?", [c.id.slice(6)]);
    const current = await c.web.get('/api/v1/web/lists/audit').query({ target: 'RK-审计测试' }).expect(200);
    assert.equal(current.body.data.total, 1);
    const historical = await c.web
      .get('/api/v1/web/lists/audit')
      .query({ target: 'RK-审计测试', from: '2020-01-01T00:00:00Z', to: '2020-01-02T00:00:00Z' })
      .expect(200);
    assert.equal(historical.body.data.total, 1);
    assert.equal(historical.body.data.items[0].id, c.id);
  } finally {
    await c.dispose();
  }
});
