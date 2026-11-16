import { createTestDatabase } from '../mysql/test-database.ts';
import { seedDemo } from '../../apps/api/src/db/seed-test.ts';
import { readDashboard } from '../../apps/api/src/features/workbench/read.ts';
import { installProbe, measurement, probe } from '../b6b/probe.ts';
import { save } from '../b6i2/telemetry.ts';
import { seedWorkbenchPerformance } from './fixture.ts';

const fixture = await createTestDatabase(),
  restore = installProbe();
try {
  await seedDemo(fixture.db, 'perf-only-password');
  console.log('B7B_PROFILE_FIXTURE', await seedWorkbenchPerformance(fixture.db));
  const sample = measurement(),
    start = performance.now();
  const data = await probe.run(sample, () =>
    fixture.db.readSnapshot(async (tx) => {
      if (process.argv.includes('--diagnose-timeout')) {
        const all = tx.all.bind(tx);
        tx.all = (sql, values) => all(sql.replace('MAX_EXECUTION_TIME(750)', 'MAX_EXECUTION_TIME(10000)'), values);
      }
      return readDashboard(tx);
    }),
  );
  const elapsed = performance.now() - start;
  await save('.local/evidence/b7b1', 'profile', { elapsed, sample, data });
  console.log('B7B_PROFILE', {
    elapsed,
    verification: data.verification,
    queries: sample.queries.map((q) => ({ ms: q.ms, rows: q.rows, sql: q.sql.slice(0, 100) })),
  });
  const plans = [];
  for (const query of sample.queries.filter((q) => q.ms > 50))
    plans.push({ query, plan: await fixture.db.all('EXPLAIN FORMAT=JSON ' + query.sql, query.values) });
  await save('.local/evidence/b7b1', 'plans', plans);
  if (process.argv.includes('--diagnose-timeout')) {
    const movement = sample.queries.find((q) => q.sql.includes('WITH journal'))!;
    await save(
      '.local/evidence/b7b1',
      'actual-plan',
      await fixture.db.all('EXPLAIN ANALYZE ' + movement.sql, movement.values),
    );
    for (const sql of [
      'SELECT COUNT(*) FROM stock_journal',
      "SELECT CAST(JSON_UNQUOTE(JSON_EXTRACT(source_row_json,'$.create_time')) AS CHAR(32)) AS time,SUM(tonnes_delta) FROM stock_journal GROUP BY time",
      "SELECT product_code,operation_id,correction_id,source_business_type,CAST(JSON_UNQUOTE(JSON_EXTRACT(source_row_json,'$.create_time')) AS CHAR(32)) AS time,SUM(tonnes_delta) FROM stock_journal GROUP BY time,product_code,operation_id,correction_id,source_business_type",
    ]) {
      const start = performance.now();
      await fixture.db.all(sql);
      console.log('B7B_SQL_DIAG', performance.now() - start, sql);
    }
  }
} finally {
  restore();
  await fixture.dispose();
}
