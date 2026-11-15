import { Session } from 'node:inspector/promises';
import type { Database } from '../../apps/api/src/db/mysql.ts';
import type { Runtime } from './runtime.ts';
import { sample, type Kind } from './browser.ts';
import { requests, save } from './telemetry.ts';

export async function profile(runtime: Runtime, db: Database, options: { kind: Kind; folder: string }) {
  const context = await runtime.browser.newContext({
    storageState: runtime.storageState,
    viewport: { width: 1440, height: 960 },
  });
  const page = await context.newPage(),
    cdp = await context.newCDPSession(page),
    server = new Session();
  server.connect();
  await server.post('Profiler.enable');
  await server.post('Profiler.start');
  await cdp.send('Profiler.enable');
  await cdp.send('Profiler.start');
  const events: unknown[] = [];
  cdp.on('Tracing.dataCollected', ({ value }) => events.push(...value));
  await cdp.send('Tracing.start', {
    categories: 'devtools.timeline,v8.execute,blink.user_timing',
    transferMode: 'ReportEvents',
  });
  try {
    const id = options.kind + '-profile';
    await sample(page, { runtime, ...options, id });
    await save(options.folder, id + '-server-cpu', (await server.post('Profiler.stop')).profile);
    await save(options.folder, id + '-browser-cpu', (await cdp.send('Profiler.stop')).profile);
    const completed = new Promise<void>((resolve) => cdp.once('Tracing.tracingComplete', () => resolve()));
    await cdp.send('Tracing.end');
    await completed;
    await save(options.folder, id + '-trace', { traceEvents: events });
    await plans(db, options.folder, id);
  } finally {
    server.disconnect();
    await context.close();
  }
}
async function plans(db: Database, folder: string, id: string) {
  const queries = requests.get(id + '-first')!.queries;
  const distinct = [...new Map([...queries].reverse().map((q) => [q.sql, q])).values()],
    results = [];
  for (const query of distinct) {
    if (!/^\s*(SELECT|WITH)/i.test(query.sql)) continue;
    results.push({
      ...query,
      explain: await db.all('EXPLAIN ' + query.sql, query.values),
      analyze: await db.all('EXPLAIN ANALYZE ' + query.sql, query.values),
    });
  }
  await save(folder, id + '-plans', results);
}
