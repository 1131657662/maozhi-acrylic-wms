import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { listFields, type ExportRequest, type WebListKind } from '@wms/contracts';
import { createTestDatabase } from '../mysql/test-database.ts';
import { seedDemo } from '../../apps/api/src/db/seed-test.ts';
import { seedListEvidence } from '../e2e-list-fixtures.ts';
import { exportReader } from '../../apps/api/src/features/web-exports/read.ts';
import { generateSnapshot } from '../../apps/api/src/features/web-exports/generate.ts';
import { newExportJob } from '../../apps/api/src/features/web-exports/job.ts';
import { XlsxWriter } from '../../apps/api/src/features/web-exports/writer.ts';
import { measurement, probe, installProbe } from '../b6b/probe.ts';
import { contentHash } from './content-hash.ts';

const phase = process.argv[2] ?? 'baseline';
assert.match(phase, /^(baseline|after)$/);
const root = '.local/evidence/b6i-1';
const count = 100_000;
const cases: { kind: WebListKind; query: Record<string, string> }[] = [
  { kind: 'stock', query: { source: 'erp-product', product: 'WL-P', sortBy: 'productCode', direction: 'asc' } },
  {
    kind: 'audit',
    query: { action: 'list.fixture', from: '2026-11-01T00:00:00.000Z', sortBy: 'createdAt', direction: 'desc' },
  },
  { kind: 'inbound', query: { keyword: 'WL-RK-', sortBy: 'receiptNo', direction: 'asc' } },
  { kind: 'outbound', query: { keyword: 'WL-CK-', sortBy: 'orderNo', direction: 'asc' } },
];
const context = await createTestDatabase(phase === 'baseline' ? '025_stocktake_discoveries' : undefined);
const restore = installProbe();
await mkdir(root, { recursive: true });

async function measure(item: (typeof cases)[number], run: number) {
  const query = { ...item.query, pageSize: '20' };
  const current = await exportReader(item.kind, query)(context.db);
  assert.equal(current.total, count);
  const request: ExportRequest = {
    kind: item.kind,
    query,
    scope: 'all',
    format: 'xlsx',
    requestId: randomUUID(),
    columns: listFields[item.kind].map((f) => f.key),
    selected: [],
    viewToken: current.viewToken,
  };
  const filename = `${root}/${phase}-${item.kind}-${run}.xlsx`;
  const writer = new XlsxWriter({ filename, kind: item.kind, fields: listFields[item.kind] });
  const sql = measurement(),
    job = newExportJob(request),
    start = performance.now();
  await probe.run(sql, () => generateSnapshot(context.db, { request, job, writer, hooks: {}, cancelled: () => false }));
  const elapsedMs = performance.now() - start;
  const content = await contentHash(filename, count);
  assert.equal(job.processed, count);
  assert.equal(content.rows, count);
  if (phase === 'after') {
    const baseline = JSON.parse(await readFile(`${root}/baseline-${item.kind}-0.json`, 'utf8'));
    assert.deepEqual(content, baseline.content);
    assert.equal(
      sql.queries.some((q) => /\bOFFSET\b/i.test(q.sql)),
      false,
    );
  }
  const paging = sql.queries.filter((q) => /ORDER BY.*LIMIT/s.test(q.sql) && !/information_schema/.test(q.sql));
  const sample = paging.at(-1)!;
  const plans = {
    explain: await context.db.all('EXPLAIN ' + sample.sql, sample.values),
    analyze: await context.db.all('EXPLAIN ANALYZE ' + sample.sql, sample.values),
  };
  const result = {
    kind: item.kind,
    run,
    elapsedMs,
    sqlMs: sql.sqlMs,
    sqlPercent: (sql.sqlMs / elapsedMs) * 100,
    content,
    sql,
    plans,
    database: context.name,
    query,
  };
  await writeFile(`${root}/${phase}-${item.kind}-${run}.json`, JSON.stringify(result, null, 2));
  console.log(
    JSON.stringify({
      kind: item.kind,
      run,
      elapsedMs,
      sqlMs: sql.sqlMs,
      sqlPercent: result.sqlPercent,
      hash: content.contentSha256,
    }),
  );
}

try {
  console.log('Seeding isolated synthetic database', context.name);
  await seedDemo(context.db, 'perf-only-password');
  await seedListEvidence(context.db, count);
  await context.db.run("UPDATE operation_log SET created_at='2026-11-02 00:00:00.000' WHERE action='list.fixture'");
  await context.db.all(
    'ANALYZE TABLE stock,master_products,inbound_receipts,inbound_lines,outbound_orders,outbound_lines,operation_log,operation_attempts',
  );
  for (let run = 0; run < (phase === 'baseline' ? 1 : 3); run++) for (const item of cases) await measure(item, run);
} finally {
  restore();
  await context.dispose();
}
