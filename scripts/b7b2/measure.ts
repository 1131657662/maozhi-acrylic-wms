import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { cpus, totalmem, platform, release } from 'node:os';
import { analysisSchema, type AnalysisQuery } from '@wms/contracts';
import { createTestDatabase } from '../mysql/test-database.ts';
import { seedDemo } from '../../apps/api/src/db/seed-test.ts';
import { analysis, clearAnalysisCache } from '../../apps/api/src/features/analysis/cache.ts';
import { readAnalysis } from '../../apps/api/src/features/analysis/read.ts';
import { installProbe, measurement, probe, p95 } from '../b6b/probe.ts';
import { runtime, type Runtime } from '../b6i2/runtime.ts';
import { save } from '../b6i2/telemetry.ts';
import { seedWorkbenchPerformance } from '../b7b1/fixture.ts';
import { browserSample, installFirstScreenProbe } from './browser.ts';
import { verifySample } from './verification.ts';

const folder = '.local/evidence/b7b-2',
  runs = 30;
const fixture = await createTestDatabase(),
  restore = installProbe();
let server: Runtime | undefined, query: AnalysisQuery;
try {
  await seedDemo(fixture.db, 'perf-only-password');
  const counts = await seedWorkbenchPerformance(fixture.db);
  query = { fromDay: counts.first, toDay: counts.last, basis: 'posted' };
  await save(folder, 'environment', {
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
      'SELECT VERSION() AS version,@@innodb_buffer_pool_size AS bufferPool,@@datadir AS dataDirectory',
    ),
  });
  server = await runtime(fixture.db);
  const results = [];
  for (const concurrency of [1, 5])
    for (const mode of ['cold', 'hot'] as const) {
      const api = await apiGroup(server, mode, concurrency),
        screen = await screenGroup(server, mode, concurrency);
      const result = {
        mode,
        concurrency,
        runs,
        apiP95Ms: p95(api.map((s) => s.elapsedMs)),
        firstScreenP95Ms: p95(screen.map((s) => s.elapsedMs)),
        invalidSamples: api.filter((s) => s.verification !== 'verified').length + screen.filter((s) => !s.valid).length,
        consistent: new Set(screen.map((s) => `${s.inbound}/${s.outbound}`)).size === 1,
        api,
        screen,
      };
      results.push(result);
      await save(folder, 'performance', results);
      console.log('B7B2_PERFORMANCE', JSON.stringify({ ...result, api: undefined, screen: undefined }));
    }
  const sql = measurement();
  await probe.run(sql, () => fixture.db.readSnapshot((tx) => readAnalysis(tx, query)));
  await save(folder, 'sql', sql);
  await screenshots(server);
  process.exitCode = results.every(
    (r) => r.invalidSamples === 0 && r.consistent && r.apiP95Ms < 2000 && r.firstScreenP95Ms < 2000,
  )
    ? 0
    : 1;
} finally {
  await server?.close();
  restore();
  await fixture.dispose();
}

async function apiGroup(server: Runtime, mode: 'cold' | 'hot', concurrency: number) {
  const context = await server.browser.newContext({ storageState: server.storageState });
  const samples = [];
  try {
    for (let offset = 0; offset < runs; offset += concurrency) {
      if (mode === 'cold') clearAnalysisCache(fixture.db);
      else await analysis(fixture.db, query);
      samples.push(
        ...(await Promise.all(
          Array.from({ length: concurrency }, async () => {
            const start = performance.now(),
              response = await context.request.get(
                server.origin + '/api/v1/web/analysis?' + new URLSearchParams(query),
              );
            const body = await response.json(),
              elapsedMs = performance.now() - start;
            assert.equal(response.status(), 200);
            const data = analysisSchema.parse(body.data),
              verification = data.monthly.verification;
            const states = verifySample(data);
            return { elapsedMs, bytes: Buffer.byteLength(JSON.stringify(body)), verification, states };
          }),
        )),
      );
    }
    return samples;
  } finally {
    await context.close();
  }
}
async function screenGroup(server: Runtime, mode: 'cold' | 'hot', concurrency: number) {
  const warm = mode === 'hot' ? await contexts(server, concurrency) : [];
  const samples = [];
  try {
    if (warm.length) await Promise.all(warm.map((c) => browserSample(c.page, server, query)));
    for (let offset = 0; offset < runs; offset += concurrency) {
      const current = warm.length ? warm : await contexts(server, concurrency);
      try {
        if (mode === 'cold') clearAnalysisCache(fixture.db);
        else await analysis(fixture.db, query);
        samples.push(...(await Promise.all(current.map((c) => browserSample(c.page, server, query)))));
      } finally {
        if (!warm.length) await Promise.all(current.map((c) => c.context.close()));
      }
    }
    return samples;
  } finally {
    await Promise.all(warm.map((c) => c.context.close()));
  }
}
async function contexts(server: Runtime, count: number) {
  return Promise.all(
    Array.from({ length: count }, async () => {
      const context = await server.browser.newContext({
        storageState: server.storageState,
        viewport: { width: 1440, height: 960 },
      });
      const page = await context.newPage();
      await installFirstScreenProbe(page);
      return { context, page };
    }),
  );
}
async function screenshots(server: Runtime) {
  const [current] = await contexts(server, 1);
  try {
    await browserSample(current!.page, server, query);
    await current!.page.getByTestId('analysis-content').waitFor();
    for (const width of [1440, 1280]) {
      await current!.page.setViewportSize({ width, height: 960 });
      await current!.page.screenshot({ path: `${folder}/dashboard-data-${width}.png`, fullPage: true });
    }
  } finally {
    await current!.context.close();
  }
}
