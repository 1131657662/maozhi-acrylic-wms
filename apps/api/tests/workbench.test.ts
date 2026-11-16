import test from 'node:test';
import assert from 'node:assert/strict';
import { WORKBENCH, workbenchSchema } from '@wms/contracts';
import { numberingFixture, newReceipt } from './numbering-fixture.ts';
import { actor } from './fixture.ts';
import { randomUUID } from 'node:crypto';
import { dashboard, clearDashboardCache } from '../src/features/workbench/cache.ts';
import { readDashboard } from '../src/features/workbench/read.ts';
import { createInbound } from '../src/features/inbound/create.ts';
import { createStocktake } from '../src/features/stocktake/create.ts';
import type { Database } from '../src/db/mysql.ts';

test('B7b aggregate authorization, strict params and true zero', async () => {
  const c = await numberingFixture();
  try {
    await c.api.get('/api/v1/web/dashboard').expect(401);
    const pda = await c.api
      .post('/api/v1/auth/login')
      .send({ username: 'owner', password: 'test-only-password', channel: 'pda' })
      .expect(200);
    await c.api.get('/api/v1/web/dashboard').set('Authorization', `Bearer ${pda.body.data.token}`).expect(403);
    await c.web.get('/api/v1/web/dashboard?unknown=1').expect(422);
    const data = workbenchSchema.parse((await c.web.get('/api/v1/web/dashboard').expect(200)).body.data);
    assert.equal(data.today.data!.inbound.grams.value, 0);
    assert.equal(data.today.data!.inboundChange.value, null);
    assert.equal(data.pending.data!.outbound.count.value, 3);
    assert.equal(data.trend14d.data!.length, WORKBENCH.trendDays);
  } finally {
    await c.dispose();
  }
});
test('B7b cache coalesces, clones, expires and invalidates on writes including concurrent snapshot', async (t) => {
  const c = await numberingFixture();
  try {
    const spy = t.mock.method(c.db, 'readSnapshot');
    const [a, b] = await Promise.all([dashboard(c.db), dashboard(c.db)]);
    assert.equal(spy.mock.callCount(), 1);
    a.pending.data!.total.value = -1;
    assert.notEqual(b.pending.data!.total.value, -1);
    await createInbound(c.db, newReceipt(), randomUUID(), actor);
    assert.equal((await dashboard(c.db)).pending.data!.inbound.count.value, 1);
    assert.equal(spy.mock.callCount(), 2);
    const now = Date.now();
    const time = t.mock.method(Date, 'now', () => now + WORKBENCH.ttlMs + 1);
    await dashboard(c.db);
    assert.equal(spy.mock.callCount(), 3);
    time.mock.restore();
    clearDashboardCache(c.db);
    const original = c.db.readSnapshot.bind(c.db);
    const race = t.mock.method(c.db, 'readSnapshot', async <T>(read: (db: Database) => Promise<T>) => {
      const result = await original(read);
      c.db.readCacheClock.version++;
      return result;
    });
    await dashboard(c.db);
    await dashboard(c.db);
    assert.equal(race.mock.callCount(), 2);
  } finally {
    await c.dispose();
  }
});
test('B7b bounded snapshot queries, pending limits, active locks and stale scans', async () => {
  const c = await numberingFixture();
  try {
    for (let n = 0; n < 7; n++) await createInbound(c.db, newReceipt(), randomUUID(), actor);
    await createStocktake(c.db, { warehouseCode: 'DEMO-WH' }, randomUUID(), actor);
    await c.db.run('UPDATE stocktake_windows SET started_at=DATE_SUB(UTC_TIMESTAMP(3),INTERVAL 25 HOUR)');
    await c.db.run(
      "UPDATE outbound_orders SET scan_closed_at=DATE_SUB(UTC_TIMESTAMP(3),INTERVAL 8 DAY) WHERE id='DEMO-001'",
    );
    const sql: string[] = [];
    const data = await c.db.readSnapshot(async (tx) => {
      const all = tx.all.bind(tx);
      tx.all = async (query, values) => {
        sql.push(query);
        return all(query, values);
      };
      return readDashboard(tx);
    });
    assert.ok(sql.length <= 13, `bounded queries: ${sql.length}`);
    assert.equal(data.pending.data!.inbound.count.value, 7);
    assert.equal(data.pending.data!.inbound.items.length, 5);
    assert.equal(data.pending.data!.stocktake.count.value, 1);
    assert.equal(data.pending.data!.stocktake.items[0]!.overdue, true);
    assert.equal(data.pending.data!.stale.count.value, 1);
  } finally {
    await c.dispose();
  }
});
test('B7b partial failure is isolated and missing source is unknown, never zero', async () => {
  const c = await numberingFixture();
  try {
    const data = await c.db.readSnapshot(async (tx) => {
      const all = tx.all.bind(tx);
      tx.all = async (sql, values) => {
        if (sql.includes('FROM pda_handoff_records')) throw new Error('private SQL detail');
        if (sql.includes('AS missingTime')) return [{ missingTime: 1, missingSource: 0 }];
        return all(sql, values);
      };
      return readDashboard(tx);
    });
    assert.equal(data.today.data!.inbound.grams.value, null);
    assert.equal(data.today.verification, 'unverifiable');
    assert.equal(data.handoffEvidence.data, null);
    assert.equal(data.handoffEvidence.verification, 'failed');
    assert.equal(data.pending.verification, 'verified');
    assert.ok(!JSON.stringify(data).includes('private SQL detail'));
  } finally {
    await c.dispose();
  }
});
