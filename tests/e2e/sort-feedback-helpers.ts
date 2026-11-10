import { expect, type Page } from '@playwright/test';

export interface SortSample {
  arrowMs: number;
  renderedMs: number;
  requestMs: number;
  minRows: number;
}
export async function startSortSample(page: Page, key: string) {
  await page.evaluate((key) => {
    const root = document.querySelector('[data-table-resize-root]')!;
    const header = root.querySelector(`th[data-column-key="${key}"]`)!;
    const order = header.getAttribute('aria-sort');
    const state = { start: 0, arrowMs: -1, renderedMs: -1, requestMs: -1, minRows: 50, busy: false };
    Object.assign(window, { sortSample: state });
    header.addEventListener(
      'click',
      () => {
        state.start = performance.now();
      },
      { capture: true, once: true },
    );
    const observer = new MutationObserver(() => {
      if (!state.start) return;
      state.minRows = Math.min(state.minRows, root.querySelectorAll('tbody tr[data-row-key]').length);
      if (state.arrowMs < 0 && header.getAttribute('aria-sort') !== order)
        state.arrowMs = performance.now() - state.start;
      if (root.getAttribute('aria-busy') === 'true') state.busy = true;
      if (!state.busy || root.getAttribute('aria-busy') !== 'false') return;
      observer.disconnect();
      requestAnimationFrame(() =>
        requestAnimationFrame(() => {
          state.renderedMs = performance.now() - state.start;
          const requests = performance.getEntriesByType('resource') as PerformanceResourceTiming[];
          state.requestMs =
            requests.filter((entry) => entry.name.includes('/web/lists/') && entry.startTime >= state.start).at(-1)
              ?.duration ?? -1;
        }),
      );
    });
    observer.observe(root, { childList: true, subtree: true, attributes: true });
  }, key);
}

export async function readSortSample(page: Page): Promise<SortSample> {
  await expect
    .poll(() => page.evaluate(() => (window as typeof window & { sortSample: SortSample }).sortSample.renderedMs))
    .toBeGreaterThan(0);
  return page.evaluate(() => {
    const { arrowMs, renderedMs, requestMs, minRows } = (window as typeof window & { sortSample: SortSample })
      .sortSample;
    return { arrowMs, renderedMs, requestMs, minRows };
  });
}

export function p95(values: number[]): number {
  return Math.round([...values].sort((a, b) => a - b)[Math.ceil(values.length * 0.95) - 1]! * 10) / 10;
}
