import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createTestDatabase } from '../mysql/test-database.ts';
import { seedDemo } from '../../apps/api/src/db/seed-test.ts';
import { seedPerformanceLines } from '../b6b/fixture.ts';
import { seedDerivedReportPerformance } from '../report-derived-performance-fixture.ts';
import { save, type RequestSample } from './telemetry.ts';
import { p95 } from '../b6b/probe.ts';

const fixture = await createTestDatabase(),
  folder = '.local/evidence/b6i2/experiments';
const results: unknown[] = [];
async function explain(label: string, sql: string, values: Parameters<typeof fixture.db.all>[1]) {
  const explain = await fixture.db.all('EXPLAIN ' + sql, values),
    analyze = await fixture.db.all('EXPLAIN ANALYZE ' + sql, values);
  const samples = [];
  let data;
  for (let run = 0; run < 10; run++) {
    const start = performance.now();
    data = await fixture.db.all(sql, values);
    samples.push(performance.now() - start);
  }
  const result = {
    label,
    sql,
    values,
    explain,
    analyze,
    p95Ms: p95(samples),
    samples,
    rows: data!.length,
    first: data![0],
  };
  results.push(result);
  await save(folder, 'plans', results);
  console.log(label, result.p95Ms, JSON.stringify(explain.map((r) => ({ table: r.table, key: r.key, type: r.type }))));
  return data!;
}
try {
  await seedDemo(fixture.db, 'perf-only-password');
  await seedPerformanceLines(fixture.db);
  await seedDerivedReportPerformance(fixture.db, 10_000, '2026-11-14');
  await fixture.db.run(
    "UPDATE master_products SET inventory_eligible=1,origin_kind='legacy' WHERE code LIKE 'B3C-PERF-%'",
  );
  await fixture.db.all(
    'ANALYZE TABLE inbound_receipts,inbound_lines,outbound_orders,outbound_lines,stock_journal,inventory_operations,master_products',
  );
  for (const kind of ['inbound', 'outbound'] as const) await reverse(kind);
  await turnover();
} finally {
  await fixture.dispose();
}

async function recorded(kind: string) {
  return JSON.parse(await readFile(`.local/evidence/b6i2/baseline/${kind}-profile-requests.json`, 'utf8')) as {
    first: RequestSample;
  };
}
async function reverse(kind: 'inbound' | 'outbound') {
  const queries = (await recorded(kind)).first.queries,
    original = queries.find((q) => q.sql.includes('AS lineCount'))!;
  const old = await explain(kind + ' original', original.sql, original.values);
  const parent = kind === 'inbound' ? 'receipt_id' : 'order_id',
    table = kind === 'inbound' ? 'inbound_receipts' : 'outbound_orders';
  const number = kind === 'inbound' ? 'receipt_no' : 'order_no',
    prefix = kind === 'inbound' ? 'WL-RK' : 'WL-CK';
  const packages = kind === 'inbound' ? 'packages' : 'planned_packages',
    tonnes = kind === 'inbound' ? 'weight_tonnes' : 'planned_weight_tonnes';
  const sql = `SELECT COUNT(DISTINCT l.${parent}) AS documentCount,COUNT(*) AS lineCount,SUM(l.${packages}) AS packages,SUM(l.${tonnes}) AS tonnes
    FROM ${kind}_lines l JOIN ${table} h ON h.id=l.${parent}
    WHERE l.product_code=? AND l.source_del_flag=0 AND h.source_del_flag=0 AND h.${number} LIKE ?`;
  const current = await explain(kind + ' direct matched aggregation', sql, ['WL-P000130', '%' + prefix + '-%']);
  assert.deepEqual({ ...current[0], documentCount: undefined }, { ...old[0], documentCount: undefined });
  await explain(kind + ' product-driven existing index', sql.replace('SELECT ', 'SELECT /*+ JOIN_ORDER(l,h) */ '), [
    'WL-P000130',
    '%' + prefix + '-%',
  ]);
}
async function turnover() {
  const q = (await recorded('turnover')).first.queries.find((q) => q.sql.includes('STRAIGHT_JOIN') && q.rows > 0)!;
  await explain('turnover first batch original', q.sql, q.values);
  await explain(
    'turnover existing PRIMARY ordered range',
    q.sql.replace('FROM stock_journal s', 'FROM stock_journal s FORCE INDEX(PRIMARY)'),
    q.values,
  );
  const count = (await recorded('turnover')).first.queries.find((q) => q.sql.startsWith('SELECT LEFT'))!;
  await explain('turnover monthly document counts unused by turnover result', count.sql, count.values);
}
