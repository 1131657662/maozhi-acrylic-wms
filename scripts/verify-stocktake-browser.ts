import { once } from 'node:events';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import express from 'express';
import { chromium } from '@playwright/test';
import { createApp } from '../apps/api/src/app.ts';
import { fixture, actor } from '../apps/api/tests/fixture.ts';
import { seedStocktakeVolume } from '../apps/api/tests/stocktake-volume-fixture.ts';
import { createStocktake } from '../apps/api/src/features/stocktake/create.ts';

const { db, dispose } = await fixture();
const app = express(),
  server = app.listen(0, '127.0.0.1');
await once(server, 'listening');
const address = server.address();
assert(address && typeof address !== 'string');
const origin = `http://127.0.0.1:${address.port}`,
  api = createApp(db, [origin]);
app.use((req, res, next) => (req.path.startsWith('/api/') ? api(req, res, next) : next()));
app.use(express.static(resolve('apps/web/dist')));
app.use((_req, res) => res.sendFile(resolve('apps/web/dist/index.html')));
const browser = await chromium.launch();
const first: number[] = [],
  paging: number[] = [];
function stats(values: number[]) {
  const sorted = [...values].sort((a, b) => a - b);
  return { p50: Math.round(sorted[14]!), p95: Math.round(sorted[28]!), max: Math.round(sorted.at(-1)!) };
}
try {
  await seedStocktakeVolume(db);
  const take = await createStocktake(db, { warehouseCode: 'COUNT-WH' }, randomUUID(), actor);
  const auth = await browser.newContext();
  const loggedIn = await auth.request.post(origin + '/api/v1/auth/login', {
    data: { username: 'owner', password: 'test-only-password', channel: 'web' },
  });
  assert.equal(loggedIn.status(), 200);
  const storageState = await auth.storageState();
  await auth.close();
  for (let n = 0; n < 30; n++) {
    const context = await browser.newContext({ storageState, viewport: { width: 1440, height: 960 } });
    try {
      const page = await context.newPage(),
        start = performance.now();
      await page.goto(`${origin}/stocktakes/${take.id}`);
      await page.locator('tr[data-row-key="COUNT-00001"]').waitFor();
      first.push(performance.now() - start);
      const flip = performance.now();
      await page.getByRole('button', { name: '下一页', exact: true }).click();
      await page.locator('tr[data-row-key="COUNT-00021"]').waitFor();
      paging.push(performance.now() - flip);
      if (n === 29) {
        await page.getByRole('combobox', { name: '页码' }).click();
        await page.getByText('200 条/页', { exact: true }).click();
        await page.waitForFunction(() => document.querySelectorAll('tbody tr[data-row-key]').length === 200);
        assert.equal(await page.locator('tbody tr[data-row-key]').count(), 200);
        for (const width of [1440, 1280]) {
          await page.setViewportSize({ width, height: 960 });
          assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
          await page.screenshot({
            path: `.local/evidence/b3a-volume-${width}.png`,
            fullPage: true,
            animations: 'disabled',
          });
        }
      }
    } finally {
      await context.close();
    }
  }
  const result = {
    build: 'production',
    rows: 10000,
    domRows: 200,
    runs: 30,
    coldContextPerRun: true,
    viewport: '1440x960',
    firstScreenMs: stats(first),
    paginationMs: stats(paging),
    firstSamplesMs: first.map(Math.round),
    pagingSamplesMs: paging.map(Math.round),
  };
  writeFileSync('.local/evidence/b3a-production-performance.json', JSON.stringify(result, null, 2));
  console.log(`B3A_BROWSER_PERF ${JSON.stringify(result)}`);
  assert(result.firstScreenMs.p95 < 1500, 'production first-screen p95 must be <1500ms');
  assert(result.paginationMs.p95 < 500, 'production pagination p95 must be <500ms');
} finally {
  await browser.close();
  await new Promise<void>((done) => server.close(() => done()));
  await dispose();
}
