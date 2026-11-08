import { once } from 'node:events';
import assert from 'node:assert/strict';
import { performance } from 'node:perf_hooks';
import { writeFileSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import express from 'express';
import ExcelJS from 'exceljs';
import { chromium, expect, type Page } from '@playwright/test';
import { createTestDatabase } from './mysql/test-database.ts';
import { seedDemo } from '../apps/api/src/db/seed-test.ts';
import { seedListEvidence } from './e2e-list-fixtures.ts';
import { createApp } from '../apps/api/src/app.ts';
import { webExports } from '../apps/api/src/features/web-exports/service.ts';

const count = Number(process.argv[2] ?? 10000);
assert.ok(count === 10000 || count === 100000);
const context = await createTestDatabase();
const app = express();
const server = app.listen(0, '127.0.0.1');
await once(server, 'listening');
const address = server.address();
if (!address || typeof address === 'string') throw new Error('Invalid local port');
const origin = 'http://127.0.0.1:' + address.port;
const api = createApp(context.db, [origin]);
app.use((req, res, next) => (req.path.startsWith('/api/') ? api(req, res, next) : next()));
app.use(express.static(resolve('apps/web/dist')));
app.use((_req, res) => res.sendFile(resolve('apps/web/dist/index.html')));
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 960 } });
const report: unknown[] = [];
mkdirSync('.local/evidence', { recursive: true });
const cases = [
  { kind: 'inbound', path: '/inbound?keyword=WL-RK-&sortBy=receiptNo&direction=asc', idColumn: 1, prefix: 'WL-RK-' },
  { kind: 'outbound', path: '/?keyword=WL-CK-&sortBy=orderNo&direction=asc', idColumn: 1, prefix: 'WL-CK-' },
  { kind: 'stock', path: '/stock?product=WL-P&sortBy=productCode&direction=asc', idColumn: 4, prefix: 'WL-P' },
  { kind: 'audit', path: '/audit?action=list.fixture&sortBy=id&direction=asc', idColumn: 2, prefix: 'WL-R' },
];
async function pageDuringExport(page: Page, kind: string, number: number): Promise<number> {
  const list = page.getByTestId(kind + '-list');
  const rows = list.locator('tbody tr[data-row-key]');
  const previous = await rows.first().getAttribute('data-row-key');
  const start = performance.now();
  await list.locator(`li[title="${number}"]`).click();
  await expect.poll(() => rows.first().getAttribute('data-row-key')).not.toBe(previous);
  return performance.now() - start;
}
async function verifyRows(filename: string, item: (typeof cases)[number]): Promise<string> {
  const reader = new ExcelJS.stream.xlsx.WorkbookReader(filename, {
    worksheets: 'emit',
    sharedStrings: 'cache',
    styles: 'ignore',
    hyperlinks: 'ignore',
    entries: 'ignore',
  });
  let rows = 0;
  let last = '';
  for await (const sheet of reader)
    for await (const row of sheet) {
      rows++;
      if (row.number < 2 || row.number > count + 1) continue;
      const id = String(row.getCell(item.idColumn).value);
      assert.equal(id, item.prefix + String(row.number - 2).padStart(6, '0'));
      last = id;
    }
  assert.equal(rows, count + 2);
  return last;
}
async function measure(item: (typeof cases)[number]): Promise<void> {
  await page.goto(origin + item.path);
  const list = page.getByTestId(item.kind + '-list');
  await expect(list.locator('tbody tr[data-row-key]')).toHaveCount(20);
  await list.getByRole('button', { name: '导出', exact: true }).click();
  const create = page.waitForResponse(
    (r) => r.url() === origin + '/api/v1/web/exports' && r.request().method() === 'POST',
  );
  const startMemory = process.memoryUsage();
  let peakHeap = startMemory.heapUsed,
    peakRss = startMemory.rss;
  const timer = setInterval(() => {
    const m = process.memoryUsage();
    peakHeap = Math.max(peakHeap, m.heapUsed);
    peakRss = Math.max(peakRss, m.rss);
  }, 20);
  const start = performance.now();
  await page.getByRole('button', { name: '生成 XLSX' }).click();
  const response = await create;
  assert.equal(response.status(), 202);
  const id = (await response.json()).data.id;
  await page.screenshot({ path: `.local/evidence/b1b2-${count}-${item.kind}-running.png` });
  await page.keyboard.press('Escape');
  const service = await webExports(context.db);
  const interactions: number[] = [];
  for (let n = 0; n < 30 && (await service.get(id)).state === 'running'; n++)
    interactions.push(await pageDuringExport(page, item.kind, n % 2 === 0 ? 2 : 1));
  await expect
    .poll(async () => (await service.get(id)).state, { timeout: 300000, intervals: [100] })
    .not.toBe('running');
  clearInterval(timer);
  const generationMs = performance.now() - start;
  const job = await service.get(id);
  assert.equal(job.state, 'ready', job.error ?? '');
  assert.equal(job.total, count);
  const file = await service.download(id);
  const downloadStart = performance.now();
  const download = await page.request.get(origin + `/api/v1/web/exports/${id}/download`);
  assert.equal(download.status(), 200);
  const bytes = await download.body();
  assert.equal(bytes.length, job.bytes);
  const downloadMs = performance.now() - downloadStart;
  const last = await verifyRows(file.path, item);
  interactions.sort((a, b) => a - b);
  const p95 = interactions[Math.max(0, Math.ceil(interactions.length * 0.95) - 1)] ?? null;
  const result = {
    count,
    kind: item.kind,
    elapsedMs: job.elapsedMs,
    observedMs: Math.round(generationMs),
    downloadMs: Math.round(downloadMs),
    bytes: job.bytes,
    heapStartMiB: Math.round(startMemory.heapUsed / 1048576),
    heapPeakMiB: Math.round(peakHeap / 1048576),
    rssPeakMiB: Math.round(peakRss / 1048576),
    interactionCount: interactions.length,
    interactionP95Ms: p95 === null ? null : Math.round(p95),
    rowsVerified: count,
    last,
    duplicates: 0,
    truncated: false,
  };
  report.push(result);
  console.log('B1B2_PERF', JSON.stringify(result));
  writeFileSync(`.local/evidence/b1b2-performance-${count}.json`, JSON.stringify(report, null, 2));
  assert.ok(job.elapsedMs < (count === 10000 ? 10000 : 60000));
}
try {
  await seedDemo(context.db, 'perf-only-password');
  await seedListEvidence(context.db, count);
  const login = await page.request.post(origin + '/api/v1/auth/login', {
    data: { username: 'owner', password: 'perf-only-password', channel: 'web' },
  });
  assert.equal(login.status(), 200);
  for (const item of cases) await measure(item);
} finally {
  await browser.close();
  await new Promise<void>((done) => server.close(() => done()));
  await context.dispose();
}
