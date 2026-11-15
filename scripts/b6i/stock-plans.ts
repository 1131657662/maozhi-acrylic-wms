import { readFile, writeFile } from 'node:fs/promises';
import { createTestDatabase } from '../mysql/test-database.ts';
import { seedDemo } from '../../apps/api/src/db/seed-test.ts';
const c = await createTestDatabase('025_stocktake_discoveries');
const plans: unknown[] = [];
try {
  await seedDemo(c.db, 'perf-only-password');
  for (let start = 0; start < 100000; start += 1000) {
    const codes = Array.from({ length: 1000 }, (_, i) => 'WL-P' + String(start + i).padStart(6, '0'));
    await c.db.run(
      `INSERT INTO master_products(code,name,source_kind,origin_kind,inventory_eligible,created_at,updated_at)
      VALUES ${codes.map(() => "(?,?,'erp-product','legacy',1,'2026-11-01','2026-11-01')").join(',')}`,
      codes.flatMap((code) => [code, '列表验收腈纶长规格名称 ' + code.slice(-6)]),
    );
    await c.db.run(
      `INSERT INTO stock(warehouse_code,product_code,packages,weight_tonnes)
      VALUES ${codes.map(() => "('DEMO-WH',?,2,'0.6000')").join(',')}`,
      codes,
    );
  }
  const experiments = JSON.parse(await readFile('.local/evidence/b6i-1/index-experiments.json', 'utf8'));
  const sample = experiments[0];
  const plain = sample.sql.replace(
    's.product_code asc,s.warehouse_code asc,s.product_code asc',
    's.product_code asc,s.warehouse_code asc',
  );
  const hint = plain.replace('SELECT ', 'SELECT /*+ JOIN_ORDER(s,p,w) NO_BNL(w) */ ');
  async function record(label: string, sql: string) {
    const plan = await c.db.all('EXPLAIN ' + sql, sample.values);
    const analyze = await c.db.all('EXPLAIN ANALYZE ' + sql, sample.values);
    plans.push({ label, sql, values: sample.values, plan, analyze });
    console.log(
      label,
      JSON.stringify(plan.map((r) => ({ table: r.table, key: r.key, extra: r.Extra }))),
      JSON.stringify(analyze).slice(0, 240),
    );
    await writeFile('.local/evidence/b6i-1/stock-index-experiments.json', JSON.stringify(plans, null, 2));
  }
  await c.db.all('ANALYZE TABLE stock,master_products');
  await record('deduplicated order', plain);
  await record('deduplicated join order', hint);
  await record('existing index forced', hint.replace('FROM stock s', 'FROM stock s FORCE INDEX(stock_product_fk)'));
  await c.db.run(
    'ALTER TABLE stock ADD INDEX export_stock_order(source_del_flag,product_code,warehouse_code), ALGORITHM=INPLACE, LOCK=NONE',
  );
  await c.db.all('ANALYZE TABLE stock');
  await record('candidate deduplicated', plain);
  await record('candidate join order', hint);
  await record('candidate forced', hint.replace('FROM stock s', 'FROM stock s FORCE INDEX(export_stock_order)'));
} finally {
  await c.dispose();
}
