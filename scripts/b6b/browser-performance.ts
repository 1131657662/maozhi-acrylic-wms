import assert from 'node:assert/strict';
import { performance } from 'node:perf_hooks';
import type { Page } from '@playwright/test';
import type { browserRuntime } from './runtime.ts';
import { requests, p95 } from './probe.ts';

type Runtime = Awaited<ReturnType<typeof browserRuntime>>;
interface Case {
  kind: 'inbound' | 'outbound';
  matched: boolean;
}
interface Sample {
  run: number;
  firstMs: number;
  pageMs: number;
  firstApiMs: number;
  pageApiMs: number;
  firstSqlMs: number;
  pageSqlMs: number;
  firstQueries: number;
  pageQueries: number;
  rows: number;
  total: number;
}
const RUNS = 30;
const PAGE_SIZE = 50;
const FIRST_TARGET = 1500;
const PAGE_TARGET = 500;
const url = (c: Case) =>
  `${c.kind === 'inbound' ? '/inbound' : '/'}?keyword=WL-${c.kind === 'inbound' ? 'RK' : 'CK'}-&pageSize=${PAGE_SIZE}${c.matched ? '&productCodes=WL-P000130' : ''}`;

async function ready(page: Page, kind: string, previous: string | null = null): Promise<void> {
  await page.waitForFunction(
    ({ kind, previous, size }) => {
      const rows = document.querySelectorAll(`[data-testid="${kind}-list"] tbody tr[data-row-key]`);
      return rows.length === size && rows[0]?.getAttribute('data-row-key') !== previous;
    },
    { kind, previous, size: PAGE_SIZE },
  );
  await page.evaluate(
    () => new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))),
  );
}

async function sample(page: Page, runtime: Runtime, c: Case, id: string, run: number): Promise<Sample> {
  await page.setExtraHTTPHeaders({ 'x-b6b-probe': id + '-first' });
  const start = performance.now();
  await page.goto(runtime.origin + url(c));
  await ready(page, c.kind);
  const firstMs = performance.now() - start;
  const rows = page.getByTestId(c.kind + '-list').locator('tbody tr[data-row-key]');
  const previous = await rows.first().getAttribute('data-row-key');
  await page.setExtraHTTPHeaders({ 'x-b6b-probe': id + '-page' });
  const pageStart = performance.now();
  await page
    .getByTestId(c.kind + '-list')
    .locator('li[title="2"]')
    .click();
  await ready(page, c.kind, previous);
  const pageMs = performance.now() - pageStart;
  const first = requests.get(id + '-first'),
    paging = requests.get(id + '-page');
  assert.ok(first && paging, 'Both requests must have SQL/HTTP telemetry');
  assert.equal(first.returned, PAGE_SIZE);
  assert.equal(paging.returned, PAGE_SIZE);
  assert.equal(first.total, 10_000);
  return {
    run,
    firstMs,
    pageMs,
    firstApiMs: first.apiMs,
    pageApiMs: paging.apiMs,
    firstSqlMs: first.sqlMs,
    pageSqlMs: paging.sqlMs,
    firstQueries: first.queries.length,
    pageQueries: paging.queries.length,
    rows: paging.returned!,
    total: first.total!,
  };
}

async function lane(runtime: Runtime, c: Case, mode: string, concurrency: number, laneIndex: number) {
  const samples: Sample[] = [];
  const warm =
    mode === 'hot'
      ? await runtime.browser.newContext({ viewport: { width: 1440, height: 960 }, storageState: runtime.storageState })
      : null;
  const warmPage = warm ? await warm.newPage() : null;
  if (warmPage) await sample(warmPage, runtime, c, `warm-${c.kind}-${c.matched}-${concurrency}-${laneIndex}`, -1);
  try {
    for (let run = laneIndex; run < RUNS; run += concurrency) {
      const session =
        warm ??
        (await runtime.browser.newContext({
          viewport: { width: 1440, height: 960 },
          storageState: runtime.storageState,
        }));
      try {
        const page = warmPage ?? (await session.newPage());
        samples.push(await sample(page, runtime, c, `${c.kind}-${c.matched}-${mode}-${concurrency}-${run}`, run));
      } finally {
        if (!warm) await session.close();
      }
    }
  } finally {
    await warm?.close();
  }
  return samples;
}

export async function measureBrowser(runtime: Runtime, save: (value: unknown) => void) {
  const results = [];
  for (const kind of ['inbound', 'outbound'] as const)
    for (const matched of [false, true]) {
      for (const concurrency of [1, 5])
        for (const mode of ['cold', 'hot']) {
          const samples = (
            await Promise.all(
              Array.from({ length: concurrency }, (_, index) =>
                lane(runtime, { kind, matched }, mode, concurrency, index),
              ),
            )
          )
            .flat()
            .sort((a, b) => a.run - b.run);
          assert.equal(samples.length, RUNS);
          const summary = {
            kind,
            matched,
            concurrency,
            mode,
            runs: samples.length,
            firstP95Ms: p95(samples.map((s) => s.firstMs)),
            pageP95Ms: p95(samples.map((s) => s.pageMs)),
            firstApiP95Ms: p95(samples.map((s) => s.firstApiMs)),
            pageApiP95Ms: p95(samples.map((s) => s.pageApiMs)),
            firstSqlP95Ms: p95(samples.map((s) => s.firstSqlMs)),
            pageSqlP95Ms: p95(samples.map((s) => s.pageSqlMs)),
            rows: PAGE_SIZE,
            total: samples[0]!.total,
          };
          const result = {
            ...summary,
            firstTargetMet: summary.firstP95Ms < FIRST_TARGET,
            pageTargetMet: summary.pageP95Ms < PAGE_TARGET,
            samples,
          };
          results.push(result);
          console.log('B6B_STEP5_PERF ' + JSON.stringify(summary));
          save(results);
        }
    }
  return results;
}
