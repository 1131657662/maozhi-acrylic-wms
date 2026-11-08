import assert from 'node:assert/strict';
import { once } from 'node:events';
import { performance } from 'node:perf_hooks';
import { resolve } from 'node:path';
import { writeFileSync, mkdirSync, copyFileSync } from 'node:fs';
import express from 'express';
import ExcelJS from 'exceljs';
import { chromium, expect } from '@playwright/test';
import { createTestDatabase } from './mysql/test-database.ts';
import { seedDemo } from '../apps/api/src/db/seed-test.ts';
import { seedReportPerformance } from './report-performance-fixture.ts';
import { createApp } from '../apps/api/src/app.ts';
import { webExports } from '../apps/api/src/features/web-exports/service.ts';

const count = 100000,
  fixture = await createTestDatabase(),
  app = express(),
  server = app.listen(0, '127.0.0.1');
await once(server, 'listening');
const address = server.address();
assert.ok(address && typeof address !== 'string');
const origin = `http://127.0.0.1:${address.port}`,
  api = createApp(fixture.db, [origin]);
app.use((req, res, next) => (req.path.startsWith('/api/') ? api(req, res, next) : next()));
app.use(express.static(resolve('apps/web/dist')));
app.use((_req, res) => res.sendFile(resolve('apps/web/dist/index.html')));
const browser = await chromium.launch(),
  page = await browser.newPage({ viewport: { width: 1440, height: 960 } });
const params = 'source=erp-product&fromDay=2026-01-01&toDay=2026-01-31&product=PERF-REPORT&direction=asc&pageSize=20';
mkdirSync('.local/evidence', { recursive: true });
try {
  await seedDemo(fixture.db, 'report-performance-only');
  await seedReportPerformance(fixture.db, count);
  assert.equal(
    (
      await page.request.post(origin + '/api/v1/auth/login', {
        data: { username: 'owner', password: 'report-performance-only', channel: 'web' },
      })
    ).status(),
    200,
  );
  const start = performance.now();
  await page.goto(origin + '/reports/details?' + params);
  const list = page.getByTestId('report-details-list'),
    rows = list.locator('tbody tr[data-row-key]:has(td[data-export-field])');
  await expect(rows).toHaveCount(20, { timeout: 30000 });
  const firstScreenMs = Math.round(performance.now() - start);
  const first = await rows.first().getAttribute('data-row-key');
  assert.equal(first, '2');
  const memory = process.memoryUsage();
  let heap = memory.heapUsed,
    rss = memory.rss;
  const timer = setInterval(() => {
    const m = process.memoryUsage();
    heap = Math.max(heap, m.heapUsed);
    rss = Math.max(rss, m.rss);
  }, 25);
  await page.getByRole('button', { name: '导出', exact: true }).click();
  const created = page.waitForResponse((r) => r.url().endsWith('/web/exports') && r.request().method() === 'POST');
  await page.getByRole('button', { name: '生成 XLSX' }).click();
  const response = await created;
  assert.equal(response.status(), 202);
  const id = (await response.json()).data.id,
    service = await webExports(fixture.db);
  await page.keyboard.press('Escape');
  const flip = performance.now();
  await list.locator('li[title="2"]').click();
  await expect(rows.first()).toHaveAttribute('data-row-key', '22', { timeout: 30000 });
  const paginationMs = Math.round(performance.now() - flip);
  const whileRunning = (await service.get(id)).state === 'running';
  await expect
    .poll(async () => (await service.get(id)).state, { timeout: 300000, intervals: [1000] })
    .not.toBe('running');
  clearInterval(timer);
  const job = await service.get(id);
  assert.equal(job.state, 'ready', job.error ?? '');
  assert.equal(job.processed, count);
  const file = await service.download(id),
    verified = await verifyFile(file.path);
  copyFileSync(file.path, '.local/evidence/b3b-100000-details.xlsx');
  const monthStart = performance.now(),
    monthly = await page.request.get(origin + '/api/v1/web/reports/monthly?' + params);
  assert.equal(monthly.status(), 200);
  const monthData = (await monthly.json()).data;
  assert.equal(monthData.report.reconciliation.differenceGrams, 0);
  assert.equal(monthData.items[0].inboundPackages, count);
  const result = {
    count,
    firstScreenMs,
    paginationMs,
    pageOperableWhileRunning: whileRunning,
    exportMs: job.elapsedMs,
    monthlyMs: Math.round(performance.now() - monthStart),
    heapStartMiB: Math.round(memory.heapUsed / 1048576),
    heapPeakMiB: Math.round(heap / 1048576),
    rssPeakMiB: Math.round(rss / 1048576),
    bytes: job.bytes,
    ...verified,
  };
  assert.ok(whileRunning);
  writeFileSync('.local/evidence/b3b-performance-100000.json', JSON.stringify(result, null, 2));
  console.log('B3B_PERF', JSON.stringify(result));
} finally {
  await browser.close();
  await new Promise<void>((r) => server.close(() => r()));
  await fixture.dispose();
}
async function verifyFile(filename: string) {
  const reader = new ExcelJS.stream.xlsx.WorkbookReader(filename, {
    worksheets: 'emit',
    sharedStrings: 'cache',
    styles: 'ignore',
    hyperlinks: 'ignore',
    entries: 'ignore',
  });
  let verified = 0,
    last = '';
  for await (const sheet of reader) {
    if (Number(sheet.id) !== 1) continue;
    for await (const row of sheet) {
      if (row.number === 1) {
        assert.equal(row.getCell(1).value, '流水 ID');
        continue;
      }
      if (row.number > count + 1) continue;
      last = String(row.getCell(1).value);
      assert.equal(last, String(row.number));
      verified++;
    }
  }
  assert.equal(verified, count);
  assert.equal(last, String(count + 1));
  return { verified, last, duplicates: 0, truncated: false };
}
