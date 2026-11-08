import { once } from 'node:events';
import assert from 'node:assert/strict';
import { performance } from 'node:perf_hooks';
import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import express from 'express';
import { chromium, type BrowserContext } from '@playwright/test';
import { seedDemo } from '../apps/api/src/db/seed-test.ts';
import { createApp } from '../apps/api/src/app.ts';
import { createTestDatabase } from './mysql/test-database.ts';
import { seedListEvidence } from './e2e-list-fixtures.ts';

const context = await createTestDatabase();
const app = express();
const server = app.listen(0, '127.0.0.1');
await once(server, 'listening');
const address = server.address();
if (!address || typeof address === 'string') throw new Error('本地测试端口无效');
const origin = 'http://127.0.0.1:' + address.port;
const api = createApp(context.db, [origin]);
app.use((req, res, next) => (req.path.startsWith('/api/') ? api(req, res, next) : next()));
app.use(express.static(resolve('apps/web/dist')));
app.use((_req, res) => res.sendFile(resolve('apps/web/dist/index.html')));
const browser = await chromium.launch();
const report: Record<string, unknown> = {
  build: 'production',
  dataset: 10000,
  viewport: '1440x960',
  runs: 30,
  coldContextPerRun: true,
};
let authentication: Awaited<ReturnType<BrowserContext['storageState']>>;
function stats(values: number[]) {
  const sorted = [...values].sort((a, b) => a - b);
  return {
    p50: Number(sorted[14]!.toFixed(2)),
    p95: Number(sorted[28]!.toFixed(2)),
    max: Number(sorted.at(-1)!.toFixed(2)),
  };
}
async function measure(kind: string, path: string): Promise<void> {
  const first: number[] = [],
    paging: number[] = [];
  for (let run = 0; run < 30; run++) {
    const session = await browser.newContext({ viewport: { width: 1440, height: 960 }, storageState: authentication });
    try {
      const page = await session.newPage();
      const start = performance.now();
      await page.goto(origin + path);
      const rows = page.getByTestId(kind + '-list').locator('tbody tr[data-row-key]');
      await rows.first().waitFor();
      first.push(performance.now() - start);
      const previous = await rows.first().getAttribute('data-row-key');
      const pageStart = performance.now();
      await page
        .getByTestId(kind + '-list')
        .locator('li[title="2"]')
        .click();
      await page.waitForFunction(
        ({ key, name }) => {
          const row = document.querySelector('[data-testid="' + name + '-list"] tbody tr[data-row-key]');
          return row !== null && row.getAttribute('data-row-key') !== key;
        },
        { key: previous, name: kind },
      );
      paging.push(performance.now() - pageStart);
    } finally {
      await session.close();
    }
  }
  const measured = { firstScreenMs: stats(first), paginationMs: stats(paging) };
  report[kind] = measured;
  console.log('B1B1_BROWSER_PERF ' + kind + ' ' + JSON.stringify(report[kind]));
  writeFileSync('.local/evidence/b1b1-browser-performance.json', JSON.stringify(report, null, 2));
  assert.ok(measured.firstScreenMs.p95 < 1500, kind + ' first-screen p95 must be <1500ms');
  assert.ok(measured.paginationMs.p95 < 500, kind + ' pagination p95 must be <500ms');
}
try {
  await seedDemo(context.db, 'perf-only-password');
  await seedListEvidence(context.db, 10000);
  const auth = await browser.newContext();
  const login = await auth.request.post(origin + '/api/v1/auth/login', {
    data: { username: 'owner', password: 'perf-only-password', channel: 'web' },
  });
  if (!login.ok()) throw new Error('性能验收登录失败：' + login.status());
  authentication = await auth.storageState();
  await auth.close();
  await measure('inbound', '/inbound?keyword=WL-RK-&pageSize=50');
  await measure('outbound', '/?keyword=WL-CK-&pageSize=50');
  await measure('stock', '/stock?product=WL-P&pageSize=50');
  await measure('audit', '/audit?action=list.fixture&pageSize=50');
  writeFileSync('.local/evidence/b1b1-browser-performance.json', JSON.stringify(report, null, 2));
} finally {
  await browser.close();
  await new Promise<void>((done) => server.close(() => done()));
  await context.dispose();
}
