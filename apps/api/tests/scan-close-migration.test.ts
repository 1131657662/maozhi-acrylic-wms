import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { fixture, actor } from './fixture.ts';
import { migrateUp, migrateDown } from '../src/db/migrate.ts';
import { tableFingerprints } from '../../../scripts/b4a-fingerprint.ts';
import { getOrder } from '../src/features/outbound/repository.ts';
import { confirmOutbound } from '../src/features/outbound/confirm.ts';

test('016 migrates legacy frozen using original submission time and permits manual confirmation', async () => {
  const c = await fixture('015_audit_attempts');
  try {
    await c.db.run("UPDATE outbound_orders SET status='frozen' WHERE id IN ('DEMO-001','DEMO-002')");
    await c.db.run("INSERT INTO scan_submissions VALUES('DEMO-001',?,0,'2026-11-10 02:03:04.123')", ['a'.repeat(64)]);
    const evidence = await c.db.all('SELECT * FROM scan_submissions');
    await migrateUp(c.db);
    const plan = await getOrder(c.db, 'DEMO-001'),
      fallback = await getOrder(c.db, 'DEMO-002');
    assert.equal(plan.status, 'open');
    assert.equal(plan.scanClosedAt, '2026-11-10T02:03:04.123Z');
    assert.equal(fallback.status, 'open');
    assert.equal(fallback.scanClosedAt, fallback.createdAt);
    const confirmed = await confirmOutbound(c.db, {
      planId: plan.id,
      expected: plan,
      actor,
      key: randomUUID(),
      lines: [{ lineId: plan.lines[0]!.id, actualPackages: 1, actualWeightGrams: 200000 }],
    });
    assert.equal(confirmed.status, 'partially_shipped');
    assert.equal(confirmed.scanClosedAt, plan.scanClosedAt);
    assert.deepEqual(await c.db.all('SELECT * FROM scan_submissions'), evidence);
    console.log('B4D_LEGACY_CLOSE frozen_to_open=true timestamp=2026-11-10T02:03:04.123Z confirmation=success');
  } finally {
    await c.dispose();
  }
});

for (const column of ['scan_packages', 'scan_weight_grams', 'scan_closed_at']) {
  test(`016 refuses down with only ${column} evidence and no shipments, without any DDL`, async () => {
    const c = await fixture('016_outbound_shipments');
    try {
      const table = column === 'scan_closed_at' ? 'outbound_orders' : 'outbound_lines';
      const value = column === 'scan_closed_at' ? "'2026-11-10 02:03:04.123'" : '0';
      await c.db.run(`UPDATE ${table} SET ${column}=${value}`);
      assert.equal((await c.db.all('SELECT * FROM outbound_shipments')).length, 0);
      const fingerprint = await tableFingerprints(c.db),
        schema = await c.db.get(`SHOW CREATE TABLE ${table}`);
      const ddl: string[] = [],
        connect = c.db.withConnection.bind(c.db);
      c.db.withConnection = (work) =>
        connect(async (connection) => {
          const run = connection.run.bind(connection);
          connection.run = (sql, values) => {
            if (/^(ALTER|CREATE|DROP|TRUNCATE)/i.test(sql.trim())) ddl.push(sql);
            return run(sql, values);
          };
          return work(connection);
        });
      await assert.rejects(migrateDown(c.db), /拒绝回退/);
      assert.deepEqual(ddl, []);
      assert.deepEqual(await tableFingerprints(c.db), fingerprint);
      assert.deepEqual(await c.db.get(`SHOW CREATE TABLE ${table}`), schema);
      console.log(`B4D_DOWN evidence=${column} shipments=0 refused=true ddl=0 unchanged=true`);
    } finally {
      await c.dispose();
    }
  });
}
