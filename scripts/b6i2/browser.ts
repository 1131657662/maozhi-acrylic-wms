import assert from 'node:assert/strict';
import { freemem, loadavg } from 'node:os';
import type { CDPSession, Page } from '@playwright/test';
import { requests, contentHash, turnoverValueHash, save } from './telemetry.ts';
import type { Runtime } from './runtime.ts';

export type Kind = 'inbound' | 'outbound' | 'turnover';
export const runs = 30,
  pageSize = 50;
export const countQueryCount = (queries: { sql: string }[]) =>
  queries.filter((query) => /^\s*SELECT\s+(?:\/\*.*?\*\/\s*)?COUNT\s*\(/i.test(query.sql)).length;
const turnoverParams = new URLSearchParams({
  scope: 'inventory',
  fromDay: '2026-06-01',
  toDay: '2026-11-14',
  asOf: '2026-11-15T00:00:00.000Z',
  product: 'B3C-PERF',
  pageSize: String(pageSize),
  sortBy: 'warehouseCode',
  direction: 'asc',
});
export const url = (kind: Kind) =>
  kind === 'turnover'
    ? `/reports/turnover?${turnoverParams}`
    : `${kind === 'inbound' ? '/inbound' : '/'}?keyword=WL-${kind === 'inbound' ? 'RK' : 'CK'}-&pageSize=${pageSize}&productCodes=WL-P000130`;

async function ready(page: Page, kind: Kind, previous: string | null = null) {
  await page.waitForFunction(
    ({ kind, previous, pageSize }) => {
      const name = kind === 'turnover' ? 'report-turnover' : kind;
      const rows = document.querySelectorAll(
        `[data-testid="${name}-list"] tbody tr[data-row-key]:has(td[data-export-field])`,
      );
      return rows.length === pageSize && rows[0]?.getAttribute('data-row-key') !== previous;
    },
    { kind, previous, pageSize },
    { timeout: 30_000 },
  );
  await page.evaluate(
    () => new Promise<void>((done) => requestAnimationFrame(() => requestAnimationFrame(() => done()))),
  );
}
async function metrics(cdp: CDPSession) {
  const result = await cdp.send('Performance.getMetrics');
  return Object.fromEntries(result.metrics.map((m: { name: string; value: number }) => [m.name, m.value]));
}
async function navigate(
  page: Page,
  cdp: CDPSession,
  input: { runtime: Runtime; kind: Kind; id: string; beforeNavigate?: () => void },
) {
  input.beforeNavigate?.();
  await page.setExtraHTTPHeaders({ 'x-b6i2-probe': input.id + '-first' });
  const start = performance.now();
  await page.goto(input.runtime.origin + url(input.kind), { waitUntil: 'domcontentloaded' });
  await ready(page, input.kind);
  const elapsedMs = performance.now() - start;
  return { elapsedMs, metrics: await metrics(cdp), request: requests.get(input.id + '-first')! };
}
async function flip(page: Page, cdp: CDPSession, input: { kind: Kind; id: string }) {
  const previous = await page
    .locator(`[data-testid="${input.kind}-list"] tbody tr[data-row-key]`)
    .first()
    .getAttribute('data-row-key');
  await page.setExtraHTTPHeaders({ 'x-b6i2-probe': input.id + '-page' });
  const before = await metrics(cdp),
    start = performance.now();
  await page
    .getByTestId(input.kind + '-list')
    .locator('li[title="5"]')
    .click();
  await ready(page, input.kind, previous);
  const elapsedMs = performance.now() - start,
    after = await metrics(cdp);
  return {
    elapsedMs,
    metrics: Object.fromEntries(Object.entries(after).map(([k, v]) => [k, v - (before[k] ?? 0)])),
    request: requests.get(input.id + '-page')!,
  };
}
export async function sample(
  page: Page,
  input: {
    runtime: Runtime;
    kind: Kind;
    id: string;
    folder: string;
    beforeNavigate?: () => void;
    assertCountReuse?: boolean;
  },
) {
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Performance.enable');
  const first = await navigate(page, cdp, input),
    result = input.kind === 'turnover' ? first : await flip(page, cdp, input);
  assert.ok(result.request?.data, 'Missing request telemetry');
  if (input.assertCountReuse && input.kind !== 'turnover') {
    assert.equal(countQueryCount(first.request.queries), 1);
    assert.equal(countQueryCount(result.request.queries), 0);
  }
  assert.equal(result.request.data.total, input.kind === 'turnover' ? 50 : 10_000);
  await save(input.folder, input.id + '-requests', { first: first.request, measured: result.request });
  await cdp.detach();
  const m = result.metrics,
    r = result.request;
  return {
    id: input.id,
    elapsedMs: result.elapsedMs,
    firstMs: first.elapsedMs,
    apiMs: r.apiMs,
    sqlMs: r.sqlMs,
    queries: r.queries.length,
    counts: countQueryCount(r.queries),
    scriptMs: m.ScriptDuration * 1000,
    layoutMs: m.LayoutDuration * 1000,
    styleMs: m.RecalcStyleDuration * 1000,
    bytes: r.bytes,
    hash: contentHash(r.data),
    comparisonHash: input.kind === 'turnover' ? turnoverValueHash(r.data) : contentHash(r.data),
    freeMemory: freemem(),
    loadAverage: loadavg(),
  };
}
