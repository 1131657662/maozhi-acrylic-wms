import assert from 'node:assert/strict';
import type { Page } from '@playwright/test';
import { workbenchSchema } from '@wms/contracts';
import type { Runtime } from '../b6i2/runtime.ts';

export async function installFirstScreenProbe(page: Page) {
  await page.addInitScript(() => {
    const observer = new MutationObserver(() => {
      if (!document.querySelector('[data-testid="workbench-todos"]')) return;
      observer.disconnect();
      requestAnimationFrame(() => requestAnimationFrame(() => performance.mark('b7b-first-screen')));
    });
    observer.observe(document, { childList: true, subtree: true });
  });
}
export async function browserSample(page: Page, runtime: Runtime) {
  const response = page.waitForResponse((r) => r.url().endsWith('/web/dashboard'));
  await page.goto(runtime.origin + '/');
  await page.waitForFunction(() => performance.getEntriesByName('b7b-first-screen').length > 0);
  const api = await response,
    body = await api.json(),
    data = workbenchSchema.parse(body.data);
  assert.equal(api.status(), 200);
  const elapsedMs = await page.evaluate(() => performance.getEntriesByName('b7b-first-screen')[0]!.startTime);
  const resource = await page.evaluate(() => {
    const entry = performance.getEntriesByType('resource').find((r) => r.name.endsWith('/web/dashboard'));
    return entry ? { start: entry.startTime, duration: entry.duration } : null;
  });
  const timing = api.request().timing();
  return {
    elapsedMs,
    resource,
    apiMs: timing.responseEnd - timing.requestStart,
    bytes: Buffer.byteLength(JSON.stringify(body)),
    verification: data.verification,
    inbound: data.today.data?.inbound.grams.value ?? null,
    pending: data.pending.data?.total.value ?? null,
  };
}
