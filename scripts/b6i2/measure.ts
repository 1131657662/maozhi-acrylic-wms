import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { cpus, totalmem, platform, release } from 'node:os';
import { createTestDatabase } from '../mysql/test-database.ts';
import { seedDemo } from '../../apps/api/src/db/seed-test.ts';
import { seedPerformanceLines } from '../b6b/fixture.ts';
import { seedDerivedReportPerformance } from '../report-derived-performance-fixture.ts';
import { installProbe, p95 } from '../b6b/probe.ts';
import { runtime, type Runtime } from './runtime.ts';
import { sample, runs, type Kind } from './browser.ts';
import { profile } from './profile.ts';
import { save } from './telemetry.ts';

const stage = process.argv[2];
assert.ok(['baseline', 'after'].includes(stage!), 'Specify baseline or after');
const folder = `.local/evidence/b6i2/${stage}`,
  fixture = await createTestDatabase(),
  restore = installProbe();
let server: Runtime | undefined;
try {
  console.log('B6I2 seeding isolated fixture', fixture.name);
  await seedDemo(fixture.db, 'perf-only-password');
  const counts = await seedPerformanceLines(fixture.db);
  await seedDerivedReportPerformance(fixture.db, 10_000, '2026-11-14');
  await fixture.db.run(
    "UPDATE master_products SET inventory_eligible=1,origin_kind='legacy' WHERE code LIKE 'B3C-PERF-%'",
  );
  await fixture.db.all(
    'ANALYZE TABLE inbound_receipts,inbound_lines,outbound_orders,outbound_lines,stock_journal,inventory_operations,master_products',
  );
  await save(folder, 'environment', {
    stage,
    counts,
    node: process.version,
    cpu: cpus()[0]?.model,
    cores: cpus().length,
    memory: totalmem(),
    os: `${platform()} ${release()}`,
    database: fixture.name,
    buildHash: createHash('sha256')
      .update(await readFile('apps/web/dist/umi.js'))
      .digest('hex'),
    mysql: await fixture.db.get(
      'SELECT VERSION() AS version,@@innodb_buffer_pool_size AS bufferPool,@@slow_query_log AS slowLog,@@long_query_time AS longQuery',
    ),
  });
  server = await runtime(fixture.db);
  const results = [];
  for (const kind of ['inbound', 'outbound', 'turnover'] as const) {
    for (const mode of kind === 'turnover' ? ['cold', 'hot'] : ['cold']) {
      const result = await group(server, kind, mode);
      results.push(result);
      await save(folder, 'summary', results);
      console.log('B6I2', JSON.stringify({ ...result, samples: undefined }));
    }
    await profile(server, fixture.db, { kind, folder });
  }
  if (stage === 'after') await compare(results);
} finally {
  await server?.close();
  restore();
  await fixture.dispose();
}

async function group(runtime: Runtime, kind: Kind, mode: string) {
  const options = { storageState: runtime.storageState, viewport: { width: 1440, height: 960 } };
  const warm = mode === 'hot' ? await runtime.browser.newContext(options) : undefined;
  const warmPage = warm ? await warm.newPage() : undefined,
    samples = [];
  try {
    if (warmPage) await sample(warmPage, { runtime, kind, id: `${kind}-${mode}-warm`, folder });
    for (let run = 0; run < runs; run++) {
      const context = warm ?? (await runtime.browser.newContext(options));
      try {
        samples.push(
          await sample(warmPage ?? (await context.newPage()), { runtime, kind, id: `${kind}-${mode}-${run}`, folder }),
        );
      } finally {
        if (!warm) await context.close();
      }
    }
  } finally {
    await warm?.close();
  }
  assert.equal(new Set(samples.map((s) => s.hash)).size, 1, 'Business data must remain fixed');
  return {
    kind,
    mode,
    runs,
    p95Ms: p95(samples.map((s) => s.elapsedMs)),
    p50Ms: [...samples].sort((a, b) => a.elapsedMs - b.elapsedMs)[14]!.elapsedMs,
    apiP95Ms: p95(samples.map((s) => s.apiMs)),
    sqlP95Ms: p95(samples.map((s) => s.sqlMs)),
    scriptP95Ms: p95(samples.map((s) => s.scriptMs)),
    bytes: samples[0]!.bytes,
    hash: samples[0]!.hash,
    samples,
  };
}
async function compare(results: Awaited<ReturnType<typeof group>>[]) {
  const baseline = JSON.parse(await readFile('.local/evidence/b6i2/baseline/summary.json', 'utf8')) as typeof results;
  for (const result of results)
    assert.equal(
      result.hash,
      baseline.find((b) => b.kind === result.kind && b.mode === result.mode)!.hash,
      `${result.kind}/${result.mode} business content changed`,
    );
  await save(
    folder,
    'comparison',
    results.map((result) => ({
      kind: result.kind,
      mode: result.mode,
      hashMatches: true,
      before: baseline.find((b) => b.kind === result.kind && b.mode === result.mode)!.p95Ms,
      after: result.p95Ms,
    })),
  );
}
