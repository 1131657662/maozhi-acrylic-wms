import { expect, type Page } from '@playwright/test';

interface Gesture {
  start: number;
  up: number;
  end: number;
}
interface Task {
  startTime: number;
  duration: number;
}
interface Evidence {
  tasks: Task[];
  gestures: Gesture[];
  observer: PerformanceObserver;
  start: number;
}
type EvidenceWindow = Window & { resizePerformance: Evidence };
export const RESIZE_SAMPLE = { count: 10, steps: 40, stepMs: 25, delta: 100 } as const;

export async function observeResizePerformance(page: Page) {
  await page.evaluate(() => {
    const tasks: Task[] = [];
    const observer = new PerformanceObserver((list) => {
      list.getEntries().forEach(({ startTime, duration }) => tasks.push({ startTime, duration }));
    });
    observer.observe({ type: 'longtask' });
    Object.assign(window, { resizePerformance: { tasks, observer, gestures: [], start: performance.now() } });
  });
}

export async function markResize(page: Page, phase: keyof Gesture) {
  await page.evaluate((phase) => {
    const record = (window as EvidenceWindow).resizePerformance;
    if (phase === 'start') record.gestures.push({ start: performance.now(), up: 0, end: 0 });
    else record.gestures.at(-1)![phase] = performance.now();
  }, phase);
}

export async function readResizePerformance(page: Page) {
  return page.evaluate(async () => {
    await new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
    const record = (window as EvidenceWindow).resizePerformance;
    record.observer.takeRecords().forEach(({ startTime, duration }) => record.tasks.push({ startTime, duration }));
    record.observer.disconnect();
    return { tasks: record.tasks, gestures: record.gestures, duration: performance.now() - record.start };
  });
}

export async function dragResize(page: Page, key: string, delta: number) {
  const handle = page.getByTestId(`resize-${key}`);
  const box = (await handle.boundingBox())!;
  const x = box.x + box.width / 2,
    y = box.y + box.height / 2;
  const before = Number(await handle.getAttribute('aria-valuenow'));
  await page.mouse.move(x, y);
  await markResize(page, 'start');
  await page.mouse.down();
  for (let step = 1; step <= RESIZE_SAMPLE.steps; step++) {
    await page.mouse.move(x + (delta * step) / RESIZE_SAMPLE.steps, y);
    await page.waitForTimeout(RESIZE_SAMPLE.stepMs);
  }
  expect(await handle.evaluate((node) => node.closest('th')!.getBoundingClientRect().width)).toBe(before + delta);
  await expect(handle).toHaveAttribute('aria-valuenow', String(before));
  await markResize(page, 'up');
  await page.mouse.up();
  await markResize(page, 'end');
  await expect(handle).toHaveAttribute('aria-valuenow', String(before + delta));
  return before + delta;
}
