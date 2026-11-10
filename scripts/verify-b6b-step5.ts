import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { cpus, totalmem, release } from 'node:os';
import { execFileSync } from 'node:child_process';
import { createTestDatabase } from './mysql/test-database.ts';
import { seedDemo } from '../apps/api/src/db/seed-test.ts';
import { seedPerformanceLines } from './b6b/fixture.ts';
import { browserRuntime } from './b6b/runtime.ts';
import { measureBrowser } from './b6b/browser-performance.ts';
import { installProbe } from './b6b/probe.ts';
import { diagnoseStock } from './b6b/stock-diagnostic.ts';

const root = '.local/evidence/b6b-step5';
mkdirSync(root, { recursive: true });
const save = (name: string, data: unknown) => writeFileSync(`${root}/${name}.json`, JSON.stringify(data, null, 2));
const context = await createTestDatabase();
const restoreProbe = installProbe();
try {
  await seedDemo(context.db, 'perf-only-password');
  const dataset = await seedPerformanceLines(context.db);
  save('environment', {
    database: context.name,
    dataset,
    node: process.version,
    mysql: await context.db.get('SELECT VERSION() AS version,@@port AS port'),
    cpu: cpus()[0]?.model,
    logicalCpus: cpus().length,
    ramBytes: totalmem(),
    disk:
      process.platform === 'win32'
        ? JSON.parse(
            execFileSync(
              'powershell.exe',
              [
                '-NoProfile',
                '-Command',
                'Get-Partition -DriveLetter D | Get-Disk | Select-Object FriendlyName,BusType,Size | ConvertTo-Json -Compress',
              ],
              { encoding: 'utf8' },
            ),
          )
        : 'See host storage inventory',
    os: release(),
    revision: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(),
    sourceTreeDirty: Boolean(execFileSync('git', ['status', '--porcelain'], { encoding: 'utf8' }).trim()),
    bundleSha256: createHash('sha256').update(readFileSync('apps/web/dist/umi.js')).digest('hex'),
    cold: 'New browser context per sample; database buffer pool is not flushed',
    hot: 'Reused browser context per lane; one unmeasured warmup; full navigation per sample',
    sqlTiming: 'Awaited mysql2 query + transfer/decode, SELECT only; transaction connection acquisition is in API time',
    frontend: 'Production bundle, 1440x960, 50 rows, until row render + 2 animation frames',
    p95: 'Nearest rank: sorted index ceil(30*0.95)-1',
    runs: 30,
    concurrency: [1, 5],
  });
  const runtime = await browserRuntime(context.db);
  try {
    await measureBrowser(runtime, (data) => save('performance', data));
  } finally {
    await runtime.close();
  }
  save('stock-diagnostic', await diagnoseStock(context.db));
} finally {
  restoreProbe();
  await context.dispose();
}
