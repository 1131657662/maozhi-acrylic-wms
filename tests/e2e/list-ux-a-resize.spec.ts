import { writeFile } from 'node:fs/promises';
import { expect, type Page } from '@playwright/test';
import { WEB_LIST_VIEW_SCHEMA_VERSION } from '@wms/contracts';
import { test } from './list-test';
import { e2eDatabase } from './inventory-helpers';
import { seedListEvidence } from '../../scripts/e2e-list-fixtures';
import { columnMetrics, resizeColumn } from './column-helpers';

const evidenceRoot = '.local/evidence/list-ux-a';
async function fixedPositions(page: Page) {
  return page.locator('[data-table-resize-root]').evaluate((root) => {
    const body = root.querySelector('.ant-table-body')!.getBoundingClientRect();
    const headers = [...root.querySelectorAll<HTMLTableCellElement>('thead th[data-column-key]')];
    const fixed = headers.filter((cell) => cell.style.insetInlineStart || cell.style.insetInlineEnd);
    const first = fixed[0]!.getBoundingClientRect(),
      last = fixed.at(-1)!.getBoundingClientRect();
    return {
      keys: fixed.map((cell) => cell.dataset.columnKey),
      left: first.x - body.x,
      right: body.right - last.right,
      gap: last.x - first.right,
    };
  });
}

async function observeLongTasks(page: Page) {
  await page.evaluate(() => {
    const tasks: { startTime: number; duration: number }[] = [];
    const observer = new PerformanceObserver((list) => {
      list.getEntries().forEach(({ startTime, duration }) => tasks.push({ startTime, duration }));
    });
    observer.observe({ type: 'longtask' });
    Object.assign(window, { dragEvidence: { tasks, observer, start: performance.now() } });
  });
}

async function readLongTasks(page: Page) {
  return page.evaluate(() => {
    const { dragEvidence: record } = window as typeof window & {
      dragEvidence: { tasks: { startTime: number; duration: number }[]; observer: PerformanceObserver; start: number };
    };
    record.observer.takeRecords().forEach(({ startTime, duration }) => record.tasks.push({ startTime, duration }));
    record.observer.disconnect();
    return { duration: performance.now() - record.start, tasks: record.tasks };
  });
}

for (const kind of ['inbound', 'outbound'] as const) {
  test(`体验A ${kind} 固定列/宽屏拖拽/DOM预览/长任务`, async ({ page }) => {
    test.setTimeout(60000);
    const db = e2eDatabase();
    try {
      await seedListEvidence(db);
    } finally {
      await db.close();
    }
    const legacy = await page.request.put(`/api/v1/me/list-preferences/${kind}`, {
      headers: { Origin: 'http://127.0.0.1:5174' },
      data: { schemaVersion: WEB_LIST_VIEW_SCHEMA_VERSION, columns: { status: { fixed: 'right', width: 240 } } },
    });
    expect(legacy.ok()).toBe(true);
    await page.setViewportSize({ width: 1280, height: 960 });
    await page.goto(kind === 'inbound' ? '/inbound?keyword=WL-RK-' : '/?keyword=WL-CK-');
    const list = page.getByTestId(`${kind}-list`);
    await expect(list.locator('tbody tr[data-row-key]')).toHaveCount(50);
    const key = kind === 'inbound' ? 'receiptNo' : 'orderNo';
    const positions = await fixedPositions(page);
    expect(positions.keys).toEqual([key, 'action']);
    await list.locator('.ant-table-body').evaluate((body) => {
      body.scrollLeft = 500;
    });
    await expect.poll(() => fixedPositions(page)).toEqual(positions);
    const handle = page.getByTestId(`resize-${key}`);
    await handle.hover();
    const box = (await handle.boundingBox())!;
    const before = await columnMetrics(page, kind);
    let saves = 0;
    page.on('request', (request) => {
      if (request.method() === 'PUT' && request.url().includes('/list-preferences/')) saves++;
    });
    await observeLongTasks(page);
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    for (let step = 1; step <= 40; step++) {
      await page.mouse.move(box.x + box.width / 2 + step * 2.5, box.y + box.height / 2);
      await page.waitForTimeout(25);
    }
    const preview = await columnMetrics(page, kind);
    expect(preview.widths[key]).toBe(before.widths[key]! + 100);
    expect(preview.alignment).toEqual(Object.fromEntries(Object.keys(preview.alignment).map((name) => [name, 0])));
    await expect(handle).toHaveAttribute('aria-valuenow', String(before.widths[key]));
    expect(saves).toBe(0);
    const during = await fixedPositions(page);
    expect(during.gap).toBeGreaterThan(0);
    expect(during.left).toBe(positions.left);
    expect(during.right).toBe(positions.right);
    const performance = await readLongTasks(page);
    expect(performance.duration).toBeGreaterThanOrEqual(1000);
    expect(performance.tasks.filter((task) => task.duration > 50)).toEqual([]);
    await page.mouse.up();
    await expect(handle).toHaveAttribute('aria-valuenow', String(before.widths[key]! + 100));
    await expect.poll(() => saves).toBe(1);
    const resized = await columnMetrics(page, kind);
    for (const name of Object.keys(before.widths))
      if (name !== key) expect(resized.widths[name]).toBe(before.widths[name]);
    expect(resized.scrollLeft).toBe(before.scrollLeft);
    await resizeColumn(page, 'action', -40);
    expect((await fixedPositions(page)).gap).toBeGreaterThan(0);
    await list.locator('tbody tr[data-row-key]').first().getByRole('checkbox').check();
    const dimensions = [];
    for (const width of [1280, 1440]) {
      await page.setViewportSize({ width, height: 960 });
      await page.screenshot({ path: `${evidenceRoot}/${kind}-resized-batch-${width}.png`, fullPage: true });
      dimensions.push({ viewport: width, ...(await columnMetrics(page, kind)) });
    }
    await page.setViewportSize({ width: 3000, height: 960 });
    const wideBefore = await columnMetrics(page, kind);
    expect(wideBefore.scrollWidth).toBe(wideBefore.clientWidth);
    await resizeColumn(page, key, 100);
    const wideAfter = await columnMetrics(page, kind);
    expect(wideAfter.widths[key]).toBe(wideBefore.widths[key]! + 100);
    for (const name of Object.keys(wideBefore.widths))
      if (name !== key) expect(wideAfter.widths[name]).toBe(wideBefore.widths[name]);
    const result = {
      kind,
      before,
      preview,
      resized,
      positions,
      during,
      performance,
      dimensions,
      wideBefore,
      wideAfter,
    };
    await writeFile(`${evidenceRoot}/${kind}-resize.json`, JSON.stringify(result, null, 2));
    console.log(
      'LIST_UX_A_RESIZE',
      JSON.stringify({
        kind,
        durationMs: performance.duration,
        longTasks: performance.tasks,
        numberBefore: before.widths[key],
        numberAfter: resized.widths[key],
        scrollWidth: resized.scrollWidth,
        clientWidth: resized.clientWidth,
      }),
    );
  });
}
