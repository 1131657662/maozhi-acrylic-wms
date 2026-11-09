import assert from 'node:assert/strict';
import { once } from 'node:events';
import { performance } from 'node:perf_hooks';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { randomUUID } from 'node:crypto';
import express from 'express';
import { chromium, expect, type Page } from '@playwright/test';
import { listFields, type ReportKind } from '@wms/contracts';
import { createTestDatabase } from './mysql/test-database.ts';
import { seedDemo } from '../apps/api/src/db/seed-test.ts';
import { createApp } from '../apps/api/src/app.ts';
import { seedDerivedReportPerformance } from './report-derived-performance-fixture.ts';

const count = 10_000,
  today = new Date(Date.now() + 8 * 3600_000).toISOString().slice(0, 10),
  day = new Date(Date.parse(today + 'T00:00:00Z') - 86400_000).toISOString().slice(0, 10),
  browser = await chromium.launch();
await mkdir('.local/evidence', { recursive: true });
try {
  for (const kind of ['report-turnover', 'report-aging'] as const) await measureKind(kind);
} finally {
  await browser.close();
}

async function measureKind(kind: ReportKind): Promise<void> {
  const fixture = await createTestDatabase(),
    app = express();
  let server: ReturnType<typeof app.listen> | undefined;
  try {
    await seedDemo(fixture.db, 'b3c-performance-only');
    await seedDerivedReportPerformance(fixture.db, count, day);
    server = app.listen(0, '127.0.0.1');
    await once(server, 'listening');
    const address = server.address();
    assert.ok(address && typeof address !== 'string');
    const origin = `http://127.0.0.1:${address.port}`,
      api = createApp(fixture.db, [origin]);
    app.use((req, res, next) => (req.path.startsWith('/api/') ? api(req, res, next) : next()));
    app.use(express.static(resolve('apps/web/dist')));
    app.use((_req, res) => res.sendFile(resolve('apps/web/dist/index.html')));
    const context = await browser.newContext({ viewport: { width: 1440, height: 960 } }),
      page = await context.newPage(),
      query = reportQuery(kind, day),
      url = `/reports/${kind.slice(7)}?${new URLSearchParams(query)}`;
    await loginPage(page, origin);
    const cold = await screen(page, origin, kind, url),
      paginationMs = await flipPage(page, kind),
      hot = await screen(page, origin, kind, url),
      exportResult = await measureExport(page, origin, kind, query, hot.data.viewToken);
    await page.screenshot({ path: `.local/evidence/b3c-${kind.slice(7)}-10k.png`, fullPage: true, animations: 'disabled' });
    const result = {
      kind,
      flows: count,
      reportRows: cold.data.total,
      coldFirstScreenMs: cold.elapsedMs,
      coldIncludesFirstReportQueryAndIndexRead: true,
      coldIncludesManualOrEngineBufferPoolPrewarm: false,
      engineBufferPoolMayContainFixturePagesFromSeedWrites: true,
      hotFirstScreenMs: hot.elapsedMs,
      pageTwoMs: paginationMs,
      allRowsXlsxMs: exportResult.elapsedMs,
      xlsxState: exportResult.state,
      xlsxProcessed: exportResult.processed,
      firstScreenTargetMs: 1500,
      coldTargetMet: cold.elapsedMs < 1500,
      evidence: `.local/evidence/b3c-${kind.slice(7)}-10k.png`,
    };
    await writeFile(`.local/evidence/b3c-${kind.slice(7)}-10k.json`, JSON.stringify(result, null, 2));
    console.log('B3C_PERFORMANCE', JSON.stringify(result));
    await context.close();
  } finally {
    if (server) await new Promise<void>((done) => server!.close(() => done()));
    await fixture.dispose();
  }
}

async function loginPage(page: Page, origin: string): Promise<void> {
  const response = await page.request.post(origin + '/api/v1/auth/login', {
    data: { username: 'owner', password: 'b3c-performance-only', channel: 'web' },
  });
  assert.equal(response.status(), 200);
}

async function screen(page: Page, origin: string, kind: ReportKind, url: string) {
  const path = `/api/v1/web/reports/${kind.slice(7)}`,
    started = performance.now(),
    response = page.waitForResponse(
      (item) => item.url().includes(path) && item.request().method() === 'GET',
      { timeout: 180_000 },
    );
  await page.goto(origin + url, { waitUntil: 'domcontentloaded', timeout: 180_000 });
  const rows = page.getByTestId(`${kind}-list`).locator('tbody tr[data-row-key]:has(td[data-export-field])');
  await expect(rows).toHaveCount(20, { timeout: 180_000 });
  const received = await response;
  assert.equal(received.status(), 200, await received.text());
  const data = received.json().then((body) => body.data);
  return { elapsedMs: Math.round(performance.now() - started), data: await data };
}

async function flipPage(page: Page, kind: ReportKind): Promise<number> {
  const rows = page.getByTestId(`${kind}-list`).locator('tbody tr[data-row-key]:has(td[data-export-field])'),
    started = performance.now();
  await page.getByTestId(`${kind}-list`).locator('li[title="2"]').click();
  await expect(rows.first()).toContainText('B3c 性能商品 21');
  return Math.round(performance.now() - started);
}

async function measureExport(page: Page, origin: string, kind: ReportKind, query: Record<string, string>, viewToken: string) {
  const started = performance.now(),
    response = await page.request.post(origin + '/api/v1/web/exports', {
      headers: { Origin: origin },
      data: {
        requestId: randomUUID(),
        kind,
        scope: 'all',
        query,
        columns: listFields[kind].map((field) => field.key),
        viewToken,
        selected: [],
      },
    });
  assert.equal(response.status(), 202);
  const id = (await response.json()).data.id;
  for (let attempt = 0; attempt < 300; attempt++) {
    const job = (await (await page.request.get(`${origin}/api/v1/web/exports/${id}`)).json()).data;
    if (job.state !== 'running') {
      assert.equal(job.state, 'ready', job.error ?? '');
      assert.equal(job.processed, 50);
      return { elapsedMs: Math.round(performance.now() - started), state: job.state, processed: job.processed };
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error(`B3c ${kind} XLSX generation timed out`);
}

function reportQuery(kind: ReportKind, day: string): Record<string, string> {
  return {
    source: 'erp-product', fromDay: day, toDay: day, product: 'B3C-PERF',
    ...(kind === 'report-aging' ? { cutoffDay: day } : {}),
    page: '1', pageSize: '20', sortBy: 'warehouseCode', direction: 'asc',
  };
}
