import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { ANALYSIS, shanghaiToday } from '@wms/contracts';
import { numberingFixture, newReceipt } from './numbering-fixture.ts';
import { actor } from './fixture.ts';
import { createInbound } from '../src/features/inbound/create.ts';
import { confirmInbound } from '../src/features/inbound/confirm.ts';
import { analysis, clearAnalysisCache } from '../src/features/analysis/cache.ts';
import { readAnalysis } from '../src/features/analysis/read.ts';
import type { Database } from '../src/db/mysql.ts';

test('analysis coalesces and clones, keys by range/basis, expires and invalidates after writes', async (t) => {
  const c = await numberingFixture(),
    query = { fromDay: shanghaiToday(), toDay: shanghaiToday(), basis: 'posted' as const };
  try {
    const spy = t.mock.method(c.db, 'readSnapshot');
    const [a, b] = await Promise.all([analysis(c.db, query), analysis(c.db, query)]);
    assert.equal(spy.mock.callCount(), 1);
    a.heatmap.data!.days[0]!.value = 123;
    assert.equal(b.heatmap.data!.days[0]!.value, 0);
    await analysis(c.db, { ...query, basis: 'restated' });
    await analysis(c.db, { ...query, fromDay: query.fromDay.slice(0, 7) + '-01' });
    assert.equal(spy.mock.callCount(), query.fromDay.endsWith('-01') ? 2 : 3);
    const receipt = await createInbound(c.db, newReceipt(), randomUUID(), actor);
    await confirmInbound(c.db, receipt.id, randomUUID(), actor);
    assert.equal((await analysis(c.db, query)).comparison.data!.current.inboundGrams, 302500);
    const calls = spy.mock.callCount(),
      now = Date.now();
    const time = t.mock.method(Date, 'now', () => now + ANALYSIS.ttlMs + 1);
    await analysis(c.db, query);
    assert.equal(spy.mock.callCount(), calls + 1);
    time.mock.restore();
    clearAnalysisCache(c.db);
    const original = c.db.readSnapshot.bind(c.db);
    const race = t.mock.method(c.db, 'readSnapshot', async <T>(read: (db: Database) => Promise<T>) => {
      const data = await original(read);
      c.db.readCacheClock.version++;
      return data;
    });
    await analysis(c.db, query);
    await analysis(c.db, query);
    assert.equal(race.mock.callCount(), 2);
  } finally {
    await c.dispose();
  }
});

test('analysis executes a fixed number of batch reads in one snapshot', async () => {
  const c = await numberingFixture(),
    query = { fromDay: shanghaiToday(), toDay: shanghaiToday(), basis: 'posted' as const };
  try {
    const sql: string[] = [];
    await c.db.readSnapshot(async (tx) => {
      const all = tx.all.bind(tx);
      tx.all = async (query, values) => {
        sql.push(query);
        return all(query, values);
      };
      await readAnalysis(tx, query);
    });
    assert.equal(sql.length, 8);
    assert.ok(!sql.some((statement) => /FROM (inbound_lines|outbound_lines)\b/.test(statement)));
  } finally {
    await c.dispose();
  }
});

test('analysis waits for independent reads before rolling back a failed snapshot', async (t) => {
  const c = await numberingFixture();
  let movementFinished = false,
    rollbackAfterReads = false;
  try {
    await assert.rejects(
      c.db.readSnapshot(async (tx) => {
        const all = tx.all.bind(tx),
          run = tx.run.bind(tx);
        t.mock.method(tx, 'all', async (sql: string, values?: Parameters<Database['all']>[1]) => {
          if (sql.includes('s.packages_delta,s.tonnes_delta,s.source_row_json')) throw new Error('projection failure');
          const rows = await all(sql, values);
          if (sql.startsWith('WITH history')) movementFinished = true;
          return rows;
        });
        t.mock.method(tx, 'run', async (sql: string, values?: Parameters<Database['run']>[1]) => {
          if (sql === 'ROLLBACK') rollbackAfterReads = movementFinished;
          return run(sql, values);
        });
        return readAnalysis(tx, { fromDay: shanghaiToday(), toDay: shanghaiToday(), basis: 'posted' });
      }),
      /projection failure/,
    );
    assert.ok(rollbackAfterReads);
  } finally {
    await c.dispose();
  }
});
