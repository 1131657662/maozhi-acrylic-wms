import { writeFile } from 'node:fs/promises';
import { createTestDatabase } from '../mysql/test-database.ts';
import { seedDemo } from '../../apps/api/src/db/seed-test.ts';
import { seedListEvidence } from '../e2e-list-fixtures.ts';
import { exportReader } from '../../apps/api/src/features/web-exports/read.ts';
import { installProbe, measurement, probe } from '../b6b/probe.ts';

const c = await createTestDatabase('025_stocktake_discoveries');
const restore = installProbe();
const evidence: unknown[] = [];
async function explain(label: string, sql: string, values: Parameters<typeof c.db.all>[1]) {
  const plan = await c.db.all('EXPLAIN ' + sql, values);
  const analyze = await c.db.all('EXPLAIN ANALYZE ' + sql, values);
  const start = performance.now();
  const rows = await c.db.all(sql, values);
  const elapsedMs = performance.now() - start;
  const result = { label, sql, values, plan, analyze, elapsedMs, rows: rows.length };
  evidence.push(result);
  console.log(
    label,
    elapsedMs.toFixed(2),
    JSON.stringify(plan.map((r) => ({ table: r.table, key: r.key, extra: r.Extra }))),
  );
  await writeFile('.local/evidence/b6i-1/index-experiments.json', JSON.stringify(evidence, null, 2));
}
try {
  console.log('Seeding plans', c.name);
  await seedDemo(c.db, 'perf-only-password');
  await seedListEvidence(c.db, 100000);
  await c.db.all('ANALYZE TABLE stock,master_products,outbound_orders,outbound_lines');
  const read = exportReader('stock', {
    product: 'WL-P',
    source: 'erp-product',
    sortBy: 'productCode',
    direction: 'asc',
  });
  const current = await read(c.db);
  const sample = measurement();
  await probe.run(sample, () =>
    read(c.db, { size: 1000, snapshot: current, after: { keys: ['WL-P049999', 'DEMO-WH'], position: 50000 } }),
  );
  const main = sample.queries.find((q) => q.sql.startsWith('SELECT s.warehouse_code'))!;
  const pending = sample.queries.find((q) => q.sql.startsWith('WITH selected_lines'))!;
  await explain('stock keyset existing indexes', main.sql, main.values);
  const hint = main.sql.replace('SELECT ', 'SELECT /*+ JOIN_ORDER(s,p,w) NO_BNL(w) */ ');
  await explain('stock existing indexes ordered join', hint, main.values);
  await c.db.run(
    'ALTER TABLE stock ADD INDEX export_stock_order(source_del_flag,product_code,warehouse_code), ALGORITHM=INPLACE, LOCK=NONE',
  );
  await c.db.all('ANALYZE TABLE stock');
  await explain('stock candidate index', main.sql, main.values);
  await explain('stock candidate ordered join', hint, main.values);
  await explain('pending existing', pending.sql, pending.values);
  const products = pending.values!.filter((_, i) => i % 2 === 1);
  const sql = pending.sql.replace(
    'AND (o.warehouse_code,l.product_code)',
    `AND l.product_code IN (${products.map(() => '?').join(',')}) AND (o.warehouse_code,l.product_code)`,
  );
  await explain('pending export product range', sql, [...products, ...pending.values!]);
  await writeFile(
    '.local/evidence/b6i-1/index-inventory.json',
    JSON.stringify(
      { stock: await c.db.all('SHOW INDEX FROM stock'), lines: await c.db.all('SHOW INDEX FROM outbound_lines') },
      null,
      2,
    ),
  );
} finally {
  restore();
  await c.dispose();
}
