import assert from 'node:assert/strict';
import type { Page } from '@playwright/test';
import { analysisSchema, type AnalysisQuery } from '@wms/contracts';
import type { Runtime } from '../b6i2/runtime.ts';
import { verifySample } from './verification.ts';

export async function installFirstScreenProbe(page: Page) {
  await page.addInitScript(() => {
    const observer = new MutationObserver(() => {
      if (!document.querySelector('[data-testid="analysis-content"]')) return;
      observer.disconnect();
      requestAnimationFrame(() => requestAnimationFrame(() => performance.mark('b7b2-first-screen')));
    });
    observer.observe(document, { childList: true, subtree: true });
  });
}
export async function browserSample(page: Page, runtime: Runtime, query: AnalysisQuery) {
  const response = page.waitForResponse((r) => r.url().includes('/web/analysis?'));
  await page.goto(runtime.origin + '/dashboard?' + new URLSearchParams(query));
  await page.waitForFunction(() => performance.getEntriesByName('b7b2-first-screen').length > 0);
  const api = await response,
    body = await api.json(),
    data = analysisSchema.parse(body.data);
  assert.equal(api.status(), 200);
  const states = verifySample(data);
  const elapsedMs = await page.evaluate(() => performance.getEntriesByName('b7b2-first-screen')[0]!.startTime);
  const resource = await page.evaluate(() => {
    const entry = performance.getEntriesByType('resource').find((r) => r.name.includes('/web/analysis?'));
    return entry ? { start: entry.startTime, duration: entry.duration } : null;
  });
  // Keep the recorded first paint unchanged, then drain sidebar/chart requests before the next
  // sample. Otherwise a closed page leaves server work running and silently increases concurrency.
  await page.waitForLoadState('networkidle');
  return {
    elapsedMs,
    resource,
    bytes: Buffer.byteLength(JSON.stringify(body)),
    valid: true,
    states,
    inbound: data.comparison.data?.current.inboundGrams,
    outbound: data.comparison.data?.current.outboundGrams,
  };
}
